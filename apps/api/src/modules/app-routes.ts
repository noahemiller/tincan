import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { authGuard } from '../lib/auth-guard.js';
import { slugify } from '../lib/slugify.js';

const createServerSchema = z.object({
  name: z.string().min(2).max(80)
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(80),
  topic: z.string().max(200).optional()
});

const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  replyToMessageId: z.string().uuid().optional(),
  mediaItemIds: z.array(z.string().uuid()).max(10).optional()
});

const markReadSchema = z.object({
  lastReadMessageId: z.string().uuid().optional()
});

const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(20)
});

const threadMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  mediaItemIds: z.array(z.string().uuid()).max(10).optional()
});

const updatePreferenceSchema = z.object({
  mode: z.enum(['hidden', 'passive', 'active']),
  snoozedUntil: z.string().datetime().optional().nullable()
});

const createCommandSchema = z.object({
  command: z
    .string()
    .min(1)
    .max(32)
    .transform((value) => value.trim().toLowerCase().replace(/^\//, ''))
    .refine((value) => /^[a-z0-9_-]+$/.test(value), 'Command can only use a-z, 0-9, underscore, and dash'),
  responseText: z.string().min(1).max(4000)
});

const previewBatchSchema = z.object({
  urls: z.array(z.string().url()).max(20)
});

const createCollectionSchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().min(1).max(80),
  visibility: z.enum(['private', 'public']).default('private')
});

const addCollectionItemsSchema = z.object({
  libraryItemIds: z.array(z.string().uuid()).min(1).max(100)
});

async function requireServerMembership(userId: string, serverId: string) {
  const membership = await pool.query('SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2', [userId, serverId]);
  return membership.rowCount !== 0;
}

async function loadChannel(channelId: string) {
  const channelResult = await pool.query(
    `
    SELECT c.id, c.server_id
    FROM channels c
    WHERE c.id = $1
    `,
    [channelId]
  );

  return channelResult.rowCount ? channelResult.rows[0] : null;
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)].slice(0, 10);
}

function pickMeta(content: string, key: string) {
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const match = content.match(regex);
  return match?.[1] ?? null;
}

function pickTitle(content: string) {
  const match = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

async function upsertLinkPreview(url: string) {
  const existing = await pool.query('SELECT url, title, description, image_url, site_name, fetched_at FROM link_previews WHERE url = $1', [url]);

  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0];
  }

  let preview = {
    url,
    title: null as string | null,
    description: null as string | null,
    image_url: null as string | null,
    site_name: null as string | null
  };

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'TincanBot/0.1 (+https://tincan.local)' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/html')) {
        const html = await response.text();
        preview = {
          url,
          title: pickMeta(html, 'og:title') ?? pickTitle(html),
          description: pickMeta(html, 'og:description') ?? pickMeta(html, 'description'),
          image_url: pickMeta(html, 'og:image'),
          site_name: pickMeta(html, 'og:site_name')
        };
      }
    }
  } catch {
    // Best-effort preview fetch; store minimal row even on failure.
  }

  const stored = await pool.query(
    `
    INSERT INTO link_previews (url, title, description, image_url, site_name, fetched_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (url)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      site_name = EXCLUDED.site_name,
      fetched_at = NOW()
    RETURNING url, title, description, image_url, site_name, fetched_at
    `,
    [preview.url, preview.title, preview.description, preview.image_url, preview.site_name]
  );

  return stored.rows[0];
}

async function ingestLibraryForMessage(params: {
  serverId: string;
  channelId: string;
  messageId: string;
  userId: string;
  body: string;
  mediaItemIds?: string[];
}) {
  const urls = extractUrls(params.body);

  for (const url of urls) {
    const preview = await upsertLinkPreview(url);
    await pool.query(
      `
      INSERT INTO library_items (
        server_id, channel_id, source_message_id, posted_by_user_id, item_type, url, title, description
      )
      VALUES ($1, $2, $3, $4, 'url', $5, $6, $7)
      ON CONFLICT DO NOTHING
      `,
      [params.serverId, params.channelId, params.messageId, params.userId, url, preview.title, preview.description]
    );
  }

  if (params.mediaItemIds && params.mediaItemIds.length > 0) {
    for (const mediaItemId of params.mediaItemIds) {
      await pool.query(
        `
        INSERT INTO library_items (
          server_id, channel_id, source_message_id, posted_by_user_id, item_type, media_item_id, title
        )
        VALUES ($1, $2, $3, $4, 'media', $5, 'Attachment')
        ON CONFLICT DO NOTHING
        `,
        [params.serverId, params.channelId, params.messageId, params.userId, mediaItemId]
      );
    }
  }
}

export async function registerAppRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/me', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;
    const result = await pool.query(
      'SELECT id, email, handle, name, avatar_url, bio, created_at FROM users WHERE id = $1',
      [userId]
    );

    return { user: result.rows[0] ?? null };
  });

  app.post('/api/servers', { preHandler: authGuard }, async (request, reply) => {
    const parsed = createServerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const name = parsed.data.name;
    const baseSlug = slugify(name);
    const slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const serverResult = await client.query(
        `
        INSERT INTO servers (name, slug, owner_user_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, slug, owner_user_id, created_at
        `,
        [name, slug, userId]
      );

      const server = serverResult.rows[0];

      await client.query(
        `
        INSERT INTO memberships (user_id, server_id, role)
        VALUES ($1, $2, 'owner')
        `,
        [userId, server.id]
      );

      await client.query(
        `
        INSERT INTO channels (server_id, name, slug, created_by)
        VALUES ($1, 'general', 'general', $2)
        `,
        [server.id, userId]
      );

      await client.query('COMMIT');
      return reply.code(201).send({ server });
    } catch (error) {
      await client.query('ROLLBACK');
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to create server' });
    } finally {
      client.release();
    }
  });

  app.get('/api/servers', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;

    const result = await pool.query(
      `
      SELECT s.id, s.name, s.slug, m.role, s.created_at
      FROM memberships m
      JOIN servers s ON s.id = m.server_id
      WHERE m.user_id = $1
      ORDER BY s.created_at DESC
      `,
      [userId]
    );

    return { servers: result.rows };
  });

  app.get('/api/servers/:serverId/channels', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const userId = request.authUser!.userId;

    const membership = await pool.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, params.serverId]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT c.id, c.server_id, c.name, c.slug, c.topic, c.created_at,
             COALESCE(cp.mode, 'passive') AS notification_mode,
             cp.snoozed_until
      FROM channels c
      LEFT JOIN channel_preferences cp
        ON cp.channel_id = c.id AND cp.user_id = $2
      WHERE c.server_id = $1
      ORDER BY c.name ASC
      `,
      [params.serverId, userId]
    );

    return { channels: result.rows };
  });

  app.post('/api/servers/:serverId/channels', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const parsed = createChannelSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;

    const membership = await pool.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, params.serverId]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const channelSlug = slugify(parsed.data.name);

    try {
      const result = await pool.query(
        `
        INSERT INTO channels (server_id, name, slug, topic, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, server_id, name, slug, topic, created_at
        `,
        [params.serverId, parsed.data.name, channelSlug, parsed.data.topic ?? null, userId]
      );

      return reply.code(201).send({ channel: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: 'Channel slug already exists for this server' });
    }
  });

  app.get('/api/channels/:channelId/preferences', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const userId = request.authUser!.userId;
    const channel = await loadChannel(params.channelId);

    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const isMember = await requireServerMembership(userId, channel.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT mode, snoozed_until, updated_at
      FROM channel_preferences
      WHERE user_id = $1 AND channel_id = $2
      `,
      [userId, params.channelId]
    );

    return {
      preference:
        result.rowCount === 0
          ? { mode: 'passive', snoozed_until: null, updated_at: null }
          : result.rows[0]
    };
  });

  app.put('/api/channels/:channelId/preferences', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const parsed = updatePreferenceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const channel = await loadChannel(params.channelId);

    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const isMember = await requireServerMembership(userId, channel.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const snoozedUntil = parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil).toISOString() : null;

    await pool.query(
      `
      INSERT INTO channel_preferences (user_id, channel_id, mode, snoozed_until, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, channel_id)
      DO UPDATE SET mode = EXCLUDED.mode, snoozed_until = EXCLUDED.snoozed_until, updated_at = NOW()
      `,
      [userId, params.channelId, parsed.data.mode, snoozedUntil]
    );

    return { ok: true };
  });

  app.post('/api/channels/:channelId/uploads', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const userId = request.authUser!.userId;
    const channel = await loadChannel(params.channelId);

    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const isMember = await requireServerMembership(userId, channel.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const part = await request.file();

    if (!part) {
      return reply.code(400).send({ error: 'Expected a file upload' });
    }

    const safeName = part.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${Date.now()}-${randomUUID()}-${safeName}`;
    const destination = resolve(process.cwd(), config.uploadsDir, key);

    await mkdir(resolve(process.cwd(), config.uploadsDir), { recursive: true });
    await pipeline(part.file, createWriteStream(destination));

    const result = await pool.query(
      `
      INSERT INTO media_items (
        uploader_user_id, server_id, channel_id, original_name, mime_type, size_bytes, storage_path, public_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, original_name, mime_type, size_bytes, public_url, created_at
      `,
      [
        userId,
        channel.server_id,
        channel.id,
        part.filename,
        part.mimetype ?? 'application/octet-stream',
        part.file.bytesRead,
        key,
        `${config.uploadsBaseUrl}/${key}`
      ]
    );

    return reply.code(201).send({ media: result.rows[0] });
  });

  app.get('/api/servers/:serverId/commands', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const userId = request.authUser!.userId;

    const membership = await pool.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, params.serverId]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT id, command, response_text, created_by, created_at
      FROM custom_commands
      WHERE scope = 'server' AND server_id = $1
      ORDER BY command ASC
      `,
      [params.serverId]
    );

    return { commands: result.rows };
  });

  app.post('/api/servers/:serverId/commands', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const parsed = createCommandSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;

    const membership = await pool.query(
      'SELECT role FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, params.serverId]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO custom_commands (scope, server_id, command, response_text, created_by)
        VALUES ('server', $1, $2, $3, $4)
        RETURNING id, command, response_text, created_by, created_at
        `,
        [params.serverId, parsed.data.command, parsed.data.responseText, userId]
      );

      return reply.code(201).send({ command: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: 'Command already exists in this server' });
    }
  });

  app.get('/api/me/commands', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;

    const result = await pool.query(
      `
      SELECT id, command, response_text, created_at
      FROM custom_commands
      WHERE scope = 'user' AND user_id = $1
      ORDER BY command ASC
      `,
      [userId]
    );

    return { commands: result.rows };
  });

  app.post('/api/me/commands', { preHandler: authGuard }, async (request, reply) => {
    const parsed = createCommandSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;

    try {
      const result = await pool.query(
        `
        INSERT INTO custom_commands (scope, user_id, command, response_text, created_by)
        VALUES ('user', $1, $2, $3, $1)
        RETURNING id, command, response_text, created_at
        `,
        [userId, parsed.data.command, parsed.data.responseText]
      );

      return reply.code(201).send({ command: result.rows[0] });
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: 'You already have this command' });
    }
  });

  app.post('/api/link-previews/batch', { preHandler: authGuard }, async (request, reply) => {
    const parsed = previewBatchSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const previews = [];

    for (const url of parsed.data.urls) {
      const preview = await upsertLinkPreview(url);
      previews.push(preview);
    }

    return { previews };
  });

  app.get('/api/search/messages', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const query = request.query as { q?: string; serverId?: string; channelId?: string; limit?: string };
    const q = (query.q ?? '').trim();

    if (q.length < 2) {
      return reply.code(400).send({ error: 'q must be at least 2 characters' });
    }

    const limit = Math.min(Number(query.limit ?? 30), 100);
    const serverId = query.serverId ?? null;
    const channelId = query.channelId ?? null;

    const result = await pool.query(
      `
      SELECT m.id, m.server_id, m.channel_id, m.author_user_id, m.body, m.created_at,
             u.name AS author_name, u.handle AS author_handle,
             c.name AS channel_name, s.name AS server_name
      FROM messages m
      JOIN users u ON u.id = m.author_user_id
      JOIN channels c ON c.id = m.channel_id
      JOIN servers s ON s.id = m.server_id
      JOIN memberships ms ON ms.server_id = m.server_id AND ms.user_id = $1
      WHERE m.body ILIKE '%' || $2 || '%'
        AND ($3::uuid IS NULL OR m.server_id = $3::uuid)
        AND ($4::uuid IS NULL OR m.channel_id = $4::uuid)
      ORDER BY m.created_at DESC
      LIMIT $5
      `,
      [userId, q, serverId, channelId, limit]
    );

    return { results: result.rows };
  });

  app.get('/api/library/items', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const query = request.query as { serverId?: string; channelId?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 50), 100);

    if (!query.serverId) {
      return reply.code(400).send({ error: 'serverId is required' });
    }

    const isMember = await requireServerMembership(userId, query.serverId);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT li.id, li.item_type, li.url, li.title, li.description, li.taxonomy_terms, li.created_at,
             li.channel_id, c.name AS channel_name,
             li.posted_by_user_id, u.handle AS posted_by_handle,
             mi.public_url AS media_url,
             lp.title AS preview_title, lp.description AS preview_description, lp.image_url AS preview_image_url
      FROM library_items li
      JOIN channels c ON c.id = li.channel_id
      JOIN users u ON u.id = li.posted_by_user_id
      LEFT JOIN media_items mi ON mi.id = li.media_item_id
      LEFT JOIN link_previews lp ON lp.url = li.url
      WHERE li.server_id = $1
        AND ($2::uuid IS NULL OR li.channel_id = $2::uuid)
      ORDER BY li.created_at DESC
      LIMIT $3
      `,
      [query.serverId, query.channelId ?? null, limit]
    );

    return { items: result.rows };
  });

  app.get('/api/library/collections', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const query = request.query as { serverId?: string };

    if (!query.serverId) {
      return reply.code(400).send({ error: 'serverId is required' });
    }

    const isMember = await requireServerMembership(userId, query.serverId);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT c.id, c.server_id, c.name, c.visibility, c.created_by_user_id, c.created_at
      FROM collections c
      WHERE c.server_id = $1
        AND (c.visibility = 'public' OR c.created_by_user_id = $2)
      ORDER BY c.created_at DESC
      `,
      [query.serverId, userId]
    );

    return { collections: result.rows };
  });

  app.post('/api/library/collections', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const parsed = createCollectionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const isMember = await requireServerMembership(userId, parsed.data.serverId);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      INSERT INTO collections (server_id, name, visibility, created_by_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, server_id, name, visibility, created_by_user_id, created_at
      `,
      [parsed.data.serverId, parsed.data.name, parsed.data.visibility, userId]
    );

    return reply.code(201).send({ collection: result.rows[0] });
  });

  app.get('/api/library/collections/:collectionId/items', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { collectionId: string };
    const userId = request.authUser!.userId;

    const collectionResult = await pool.query(
      `
      SELECT id, server_id, visibility, created_by_user_id
      FROM collections
      WHERE id = $1
      `,
      [params.collectionId]
    );

    if (collectionResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];
    const isMember = await requireServerMembership(userId, collection.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    if (collection.visibility === 'private' && collection.created_by_user_id !== userId) {
      return reply.code(403).send({ error: 'Collection is private' });
    }

    const result = await pool.query(
      `
      SELECT li.id, li.item_type, li.url, li.title, li.description, li.taxonomy_terms, li.created_at,
             mi.public_url AS media_url
      FROM collection_items ci
      JOIN library_items li ON li.id = ci.library_item_id
      LEFT JOIN media_items mi ON mi.id = li.media_item_id
      WHERE ci.collection_id = $1
      ORDER BY ci.created_at DESC
      `,
      [params.collectionId]
    );

    return { items: result.rows };
  });

  app.post('/api/library/collections/:collectionId/items', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { collectionId: string };
    const parsed = addCollectionItemsSchema.safeParse(request.body);
    const userId = request.authUser!.userId;

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const collectionResult = await pool.query(
      `
      SELECT id, server_id, visibility, created_by_user_id
      FROM collections
      WHERE id = $1
      `,
      [params.collectionId]
    );

    if (collectionResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Collection not found' });
    }

    const collection = collectionResult.rows[0];
    const isMember = await requireServerMembership(userId, collection.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    if (collection.visibility === 'private' && collection.created_by_user_id !== userId) {
      return reply.code(403).send({ error: 'Collection is private' });
    }

    const validItems = await pool.query(
      `
      SELECT id
      FROM library_items
      WHERE server_id = $1
        AND id = ANY($2::uuid[])
      `,
      [collection.server_id, parsed.data.libraryItemIds]
    );

    for (const item of validItems.rows) {
      await pool.query(
        `
        INSERT INTO collection_items (collection_id, library_item_id, added_by_user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [params.collectionId, item.id, userId]
      );
    }

    return { added: validItems.rows.length };
  });

  app.get('/api/channels/:channelId/messages', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const query = request.query as { limit?: string; before?: string };
    const userId = request.authUser!.userId;

    const channelResult = await pool.query(
      `
      SELECT c.id, c.server_id
      FROM channels c
      WHERE c.id = $1
      `,
      [params.channelId]
    );

    if (channelResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    const membership = await pool.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, channel.server_id]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const limit = Math.min(Number(query.limit ?? 50), 100);
    const before = query.before;

    const messages = await pool.query(
      `
      SELECT m.id, m.channel_id, m.author_user_id, m.body, m.reply_to_message_id, m.thread_root_message_id,
             m.edited_at, m.created_at,
             u.handle AS author_handle,
             u.name AS author_name,
             (
               SELECT COUNT(*)::int
               FROM messages tm
               WHERE tm.thread_root_message_id = m.id
             ) AS thread_reply_count,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'id', mi.id,
                     'mime_type', mi.mime_type,
                     'original_name', mi.original_name,
                     'public_url', mi.public_url
                   )
                 )
                 FROM message_attachments ma
                 JOIN media_items mi ON mi.id = ma.media_item_id
                 WHERE ma.message_id = m.id
               ),
               '[]'::json
             ) AS attachments,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object('emoji', counts.emoji, 'count', counts.reaction_count)
                   ORDER BY counts.emoji
                 )
                 FROM (
                   SELECT emoji, COUNT(*)::int AS reaction_count
                   FROM reactions
                   WHERE message_id = m.id
                   GROUP BY emoji
                 ) counts
               ),
               '[]'::json
             ) AS reactions
      FROM messages m
      JOIN users u ON u.id = m.author_user_id
      WHERE m.channel_id = $1
        AND m.thread_root_message_id IS NULL
        AND ($2::timestamptz IS NULL OR m.created_at < $2)
      ORDER BY m.created_at DESC
      LIMIT $3
      `,
      [params.channelId, before ?? null, limit]
    );

    return { messages: messages.rows.reverse() };
  });

  app.post('/api/channels/:channelId/messages', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const parsed = createMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;

    const channelResult = await pool.query(
      `
      SELECT c.id, c.server_id
      FROM channels c
      WHERE c.id = $1
      `,
      [params.channelId]
    );

    if (channelResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    const membership = await pool.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, channel.server_id]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    let finalBody = parsed.data.body;

    if (finalBody.startsWith('/')) {
      const [rawCommand, ...argParts] = finalBody.trim().split(/\s+/);
      const commandName = (rawCommand ?? '').replace(/^\//, '').toLowerCase();
      const argString = argParts.join(' ');

      const commandLookup = await pool.query(
        `
        SELECT response_text
        FROM custom_commands
        WHERE
          (scope = 'user' AND user_id = $1 AND command = $2)
          OR
          (scope = 'server' AND server_id = $3 AND command = $2)
        ORDER BY
          CASE WHEN scope = 'user' THEN 0 ELSE 1 END
        LIMIT 1
        `,
        [userId, commandName, channel.server_id]
      );

      if (commandLookup.rowCount && commandLookup.rowCount > 0) {
        finalBody = (commandLookup.rows[0].response_text as string).replace(/\{\{args\}\}/g, argString);
      }
    }

    const result = await pool.query(
      `
      INSERT INTO messages (server_id, channel_id, author_user_id, body, reply_to_message_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, channel_id, author_user_id, body, reply_to_message_id, edited_at, created_at
      `,
      [channel.server_id, params.channelId, userId, finalBody, parsed.data.replyToMessageId ?? null]
    );

    let attachedMediaIds: string[] = [];

    if (parsed.data.mediaItemIds && parsed.data.mediaItemIds.length > 0) {
      const validMedia = await pool.query(
        `
        SELECT id
        FROM media_items
        WHERE channel_id = $1
          AND id = ANY($2::uuid[])
          AND uploader_user_id = $3
        `,
        [params.channelId, parsed.data.mediaItemIds, userId]
      );

      if ((validMedia.rowCount ?? 0) > 0) {
        attachedMediaIds = validMedia.rows.map((row) => row.id as string);
        for (const mediaRow of validMedia.rows) {
          await pool.query(
            `
            INSERT INTO message_attachments (message_id, media_item_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [result.rows[0].id, mediaRow.id]
          );
        }
      }
    }

    await ingestLibraryForMessage({
      serverId: channel.server_id,
      channelId: params.channelId,
      messageId: result.rows[0].id,
      userId,
      body: finalBody,
      mediaItemIds: attachedMediaIds
    });

    return reply.code(201).send({ message: result.rows[0] });
  });

  app.get('/api/messages/:messageId/thread/messages', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { messageId: string };
    const userId = request.authUser!.userId;

    const rootMessageResult = await pool.query(
      `
      SELECT id, channel_id, server_id, thread_root_message_id
      FROM messages
      WHERE id = $1
      `,
      [params.messageId]
    );

    if (rootMessageResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Root message not found' });
    }

    const rootMessage = rootMessageResult.rows[0];
    const rootMessageId = rootMessage.thread_root_message_id ?? rootMessage.id;
    const isMember = await requireServerMembership(userId, rootMessage.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT m.id, m.channel_id, m.author_user_id, m.body, m.reply_to_message_id, m.thread_root_message_id,
             m.edited_at, m.created_at,
             u.handle AS author_handle,
             u.name AS author_name,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'id', mi.id,
                     'mime_type', mi.mime_type,
                     'original_name', mi.original_name,
                     'public_url', mi.public_url
                   )
                 )
                 FROM message_attachments ma
                 JOIN media_items mi ON mi.id = ma.media_item_id
                 WHERE ma.message_id = m.id
               ),
               '[]'::json
             ) AS attachments
      FROM messages m
      JOIN users u ON u.id = m.author_user_id
      WHERE m.id = $1 OR m.thread_root_message_id = $1
      ORDER BY m.created_at ASC
      `,
      [rootMessageId]
    );

    return { messages: result.rows };
  });

  app.post('/api/messages/:messageId/thread/messages', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { messageId: string };
    const parsed = threadMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const rootMessageResult = await pool.query(
      `
      SELECT id, channel_id, server_id, thread_root_message_id
      FROM messages
      WHERE id = $1
      `,
      [params.messageId]
    );

    if (rootMessageResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Root message not found' });
    }

    const rootMessage = rootMessageResult.rows[0];
    const rootMessageId = rootMessage.thread_root_message_id ?? rootMessage.id;
    const isMember = await requireServerMembership(userId, rootMessage.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const inserted = await pool.query(
      `
      INSERT INTO messages (server_id, channel_id, author_user_id, body, reply_to_message_id, thread_root_message_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, channel_id, author_user_id, body, reply_to_message_id, thread_root_message_id, edited_at, created_at
      `,
      [rootMessage.server_id, rootMessage.channel_id, userId, parsed.data.body, params.messageId, rootMessageId]
    );

    let attachedMediaIds: string[] = [];

    if (parsed.data.mediaItemIds && parsed.data.mediaItemIds.length > 0) {
      const validMedia = await pool.query(
        `
        SELECT id
        FROM media_items
        WHERE channel_id = $1
          AND id = ANY($2::uuid[])
          AND uploader_user_id = $3
        `,
        [rootMessage.channel_id, parsed.data.mediaItemIds, userId]
      );

      attachedMediaIds = validMedia.rows.map((row) => row.id as string);

      for (const mediaRow of validMedia.rows) {
        await pool.query(
          `
          INSERT INTO message_attachments (message_id, media_item_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [inserted.rows[0].id, mediaRow.id]
        );
      }
    }

    await ingestLibraryForMessage({
      serverId: rootMessage.server_id,
      channelId: rootMessage.channel_id,
      messageId: inserted.rows[0].id,
      userId,
      body: parsed.data.body,
      mediaItemIds: attachedMediaIds
    });

    return reply.code(201).send({ message: inserted.rows[0] });
  });

  app.post('/api/channels/:channelId/read', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const parsed = markReadSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const channelResult = await pool.query(
      `
      SELECT c.id, c.server_id
      FROM channels c
      WHERE c.id = $1
      `,
      [params.channelId]
    );

    if (channelResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const membership = await pool.query(
      'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
      [userId, channelResult.rows[0].server_id]
    );

    if (membership.rowCount === 0) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    await pool.query(
      `
      INSERT INTO read_states (user_id, channel_id, last_read_message_id, last_read_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, channel_id)
      DO UPDATE SET
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_at = NOW()
      `,
      [userId, params.channelId, parsed.data.lastReadMessageId ?? null]
    );

    return { ok: true };
  });

  app.get('/api/unread', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;

    const result = await pool.query(
      `
      SELECT c.id AS channel_id,
             c.name AS channel_name,
             s.id AS server_id,
             s.name AS server_name,
             COUNT(m.id)::int AS unread_count
      FROM memberships ms
      JOIN servers s ON s.id = ms.server_id
      JOIN channels c ON c.server_id = s.id
      LEFT JOIN channel_preferences cp ON cp.user_id = ms.user_id AND cp.channel_id = c.id
      LEFT JOIN read_states rs ON rs.user_id = ms.user_id AND rs.channel_id = c.id
      LEFT JOIN messages m ON m.channel_id = c.id
        AND (
          rs.last_read_at IS NULL
          OR m.created_at > rs.last_read_at
        )
      WHERE ms.user_id = $1
        AND COALESCE(cp.mode, 'passive') <> 'hidden'
        AND (cp.snoozed_until IS NULL OR cp.snoozed_until < NOW())
      GROUP BY c.id, c.name, s.id, s.name
      HAVING COUNT(m.id) > 0
      ORDER BY s.name, c.name
      `,
      [userId]
    );

    return { unread: result.rows };
  });

  app.post('/api/messages/:messageId/reactions/toggle', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { messageId: string };
    const parsed = toggleReactionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const emoji = parsed.data.emoji;

    const existing = await pool.query(
      `
      SELECT 1
      FROM reactions
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
      `,
      [params.messageId, userId, emoji]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `
        DELETE FROM reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3
        `,
        [params.messageId, userId, emoji]
      );

      return { toggledOn: false };
    }

    await pool.query(
      `
      INSERT INTO reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      `,
      [params.messageId, userId, emoji]
    );

    return { toggledOn: true };
  });
}
