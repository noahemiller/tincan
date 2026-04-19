import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { authGuard } from '../lib/auth-guard.js';
import { slugify } from '../lib/slugify.js';
import { upsertLinkPreview } from './link-previews.js';

const createServerSchema = z.object({
  name: z.string().min(2).max(80)
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(80),
  topic: z.string().max(200).optional()
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(80)
});

const createMessageSchema = z
  .object({
    body: z.string().max(4000),
    replyToMessageId: z.string().uuid().optional(),
    mediaItemIds: z.array(z.string().uuid()).max(10).optional()
  })
  .transform((payload) => ({ ...payload, body: payload.body.trim() }))
  .superRefine((payload, context) => {
    if (!payload.body && (!payload.mediaItemIds || payload.mediaItemIds.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Message body or media attachment is required.'
      });
    }
  });

const createDirectMessageSchema = z
  .object({
    body: z.string().max(4000)
  })
  .transform((payload) => ({ ...payload, body: payload.body.trim() }))
  .superRefine((payload, context) => {
    if (!payload.body) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Message body is required.'
      });
    }
  });

const createDmConversationSchema = z.object({
  handle: z
    .string()
    .min(2)
    .max(32)
    .transform((value) => slugify(value).replace(/-/g, '_'))
});

const updateMessageSchema = z
  .object({
    body: z.string().max(4000)
  })
  .transform((payload) => ({ ...payload, body: payload.body.trim() }))
  .superRefine((payload, context) => {
    if (!payload.body) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Message body is required.'
      });
    }
  });

const markReadSchema = z.object({
  lastReadMessageId: z.string().uuid().optional()
});

const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(20)
});

const threadMessageSchema = z
  .object({
    body: z.string().max(4000),
    mediaItemIds: z.array(z.string().uuid()).max(10).optional()
  })
  .transform((payload) => ({ ...payload, body: payload.body.trim() }))
  .superRefine((payload, context) => {
    if (!payload.body && (!payload.mediaItemIds || payload.mediaItemIds.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Thread message body or media attachment is required.'
      });
    }
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

const removeCollectionItemsSchema = z.object({
  libraryItemIds: z.array(z.string().uuid()).min(1).max(100)
});

const reorderCollectionItemsSchema = z.object({
  libraryItemIds: z.array(z.string().uuid()).min(1).max(500)
});

const updateLibraryItemMetadataSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  taxonomyTerms: z.array(z.string().min(1).max(60)).max(40).optional()
});

const createInviteSchema = z.object({
  roleToGrant: z.enum(['admin', 'member']).default('member'),
  maxUses: z.number().int().positive().max(10000).optional(),
  expiresInHours: z.number().int().positive().max(24 * 365).optional()
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'])
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  handle: z
    .string()
    .min(2)
    .max(32)
    .transform((value) => slugify(value).replace(/-/g, '_'))
    .refine((value) => value.length >= 2, 'Handle must include at least 2 letters or numbers')
    .optional(),
  email: z.string().email().optional(),
  bio: z.string().max(1000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  avatarThumbUrl: z.string().url().nullable().optional(),
  homeServerId: z.string().uuid().nullable().optional()
});

type ServerRole = 'owner' | 'admin' | 'member';

async function requireServerMembership(userId: string, serverId: string) {
  const membership = await pool.query('SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2', [userId, serverId]);
  return membership.rowCount !== 0;
}

async function getServerRole(userId: string, serverId: string): Promise<ServerRole | null> {
  const membership = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND server_id = $2', [userId, serverId]);
  return membership.rowCount && membership.rowCount > 0 ? (membership.rows[0].role as ServerRole) : null;
}

function roleRank(role: ServerRole) {
  if (role === 'owner') {
    return 3;
  }
  if (role === 'admin') {
    return 2;
  }
  return 1;
}

async function requireServerRole(userId: string, serverId: string, minimum: ServerRole) {
  const role = await getServerRole(userId, serverId);

  if (!role) {
    return false;
  }

  return roleRank(role) >= roleRank(minimum);
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

async function requireDmParticipant(userId: string, conversationId: string) {
  const result = await pool.query(
    `
    SELECT id
    FROM dm_conversations
    WHERE id = $1
      AND ($2 = user_a_id OR $2 = user_b_id)
    `,
    [conversationId, userId]
  );

  return result.rowCount !== 0;
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)].slice(0, 10);
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
      'SELECT id, email, handle, name, avatar_url, avatar_thumb_url, bio, home_server_id, created_at FROM users WHERE id = $1',
      [userId]
    );

    return { user: result.rows[0] ?? null };
  });

  app.get('/api/me/profile-photos', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;
    const result = await pool.query(
      `
      SELECT id, original_name, mime_type, public_url, created_at
      FROM user_profile_photos
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 80
      `,
      [userId]
    );

    return { photos: result.rows };
  });

  app.post('/api/me/profile-photos', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const part = await request.file();

    if (!part) {
      return reply.code(400).send({ error: 'Expected a file upload' });
    }

    if (!part.mimetype?.startsWith('image/')) {
      return reply.code(400).send({ error: 'Profile photo must be an image' });
    }

    const safeName = part.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `profile-${userId}-${Date.now()}-${randomUUID()}-${safeName}`;
    const destination = resolve(process.cwd(), config.uploadsDir, key);

    await mkdir(resolve(process.cwd(), config.uploadsDir), { recursive: true });
    await pipeline(part.file, createWriteStream(destination));

    const result = await pool.query(
      `
      INSERT INTO user_profile_photos (
        user_id, original_name, mime_type, size_bytes, storage_path, public_url
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, original_name, mime_type, public_url, created_at
      `,
      [userId, part.filename, part.mimetype ?? 'application/octet-stream', part.file.bytesRead, key, `${config.uploadsBaseUrl}/${key}`]
    );

    return reply.code(201).send({ photo: result.rows[0] });
  });

  const updateMeHandler = async (request: any, reply: any) => {
    const userId = request.authUser!.userId;
    const parsed = updateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const next = parsed.data;
    const hasFields = Object.keys(next).length > 0;
    if (!hasFields) {
      return reply.code(400).send({ error: 'No profile fields provided' });
    }

    if (next.homeServerId) {
      const membership = await pool.query(
        'SELECT 1 FROM memberships WHERE user_id = $1 AND server_id = $2',
        [userId, next.homeServerId]
      );
      if (membership.rowCount === 0) {
        return reply.code(403).send({ error: 'Home server must be one of your servers' });
      }
    }

    try {
      const hasName = Object.prototype.hasOwnProperty.call(next, 'name');
      const hasHandle = Object.prototype.hasOwnProperty.call(next, 'handle');
      const hasEmail = Object.prototype.hasOwnProperty.call(next, 'email');
      const hasBio = Object.prototype.hasOwnProperty.call(next, 'bio');
      const hasAvatarUrl = Object.prototype.hasOwnProperty.call(next, 'avatarUrl');
      const hasAvatarThumbUrl = Object.prototype.hasOwnProperty.call(next, 'avatarThumbUrl');
      const hasHomeServerId = Object.prototype.hasOwnProperty.call(next, 'homeServerId');

      const result = await pool.query(
        `
        UPDATE users
        SET
          name = CASE WHEN $9::boolean THEN $2 ELSE name END,
          handle = CASE WHEN $10::boolean THEN $3 ELSE handle END,
          email = CASE WHEN $11::boolean THEN $4 ELSE email END,
          bio = CASE WHEN $12::boolean THEN $5 ELSE bio END,
          avatar_url = CASE WHEN $13::boolean THEN $6 ELSE avatar_url END,
          avatar_thumb_url = CASE WHEN $14::boolean THEN $7 ELSE avatar_thumb_url END,
          home_server_id = CASE WHEN $15::boolean THEN $8 ELSE home_server_id END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, handle, name, avatar_url, avatar_thumb_url, bio, home_server_id, created_at
        `,
        [
          userId,
          next.name ?? null,
          next.handle ?? null,
          next.email?.toLowerCase() ?? null,
          next.bio ?? null,
          next.avatarUrl ?? null,
          next.avatarThumbUrl ?? null,
          next.homeServerId ?? null,
          hasName,
          hasHandle,
          hasEmail,
          hasBio,
          hasAvatarUrl,
          hasAvatarThumbUrl,
          hasHomeServerId
        ]
      );

      return { user: result.rows[0] };
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: 'Email or handle already in use' });
    }
  };

  app.patch('/api/me', { preHandler: authGuard }, updateMeHandler);
  app.put('/api/me', { preHandler: authGuard }, updateMeHandler);
  app.post('/api/me/profile', { preHandler: authGuard }, updateMeHandler);

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

  app.get('/api/servers/:serverId/members', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const userId = request.authUser!.userId;
    const isMember = await requireServerMembership(userId, params.serverId);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const result = await pool.query(
      `
      SELECT m.user_id, m.role, m.created_at, u.handle, u.name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.server_id = $1
      ORDER BY
        CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
        u.handle
      `,
      [params.serverId]
    );

    return { members: result.rows };
  });

  app.put('/api/servers/:serverId/members/:memberUserId/role', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string; memberUserId: string };
    const parsed = updateMemberRoleSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const role = await getServerRole(userId, params.serverId);

    if (role !== 'owner') {
      return reply.code(403).send({ error: 'Owner role required' });
    }

    const targetMembership = await pool.query(
      `
      SELECT role
      FROM memberships
      WHERE server_id = $1
        AND user_id = $2
      `,
      [params.serverId, params.memberUserId]
    );

    if (targetMembership.rowCount === 0) {
      return reply.code(404).send({ error: 'Member not found' });
    }

    if (targetMembership.rows[0].role === 'owner') {
      return reply.code(400).send({ error: 'Cannot change owner role' });
    }

    await pool.query(
      `
      UPDATE memberships
      SET role = $3
      WHERE server_id = $1
        AND user_id = $2
      `,
      [params.serverId, params.memberUserId, parsed.data.role]
    );

    return { ok: true };
  });

  app.get('/api/invites/:code', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { code: string };
    const userId = request.authUser!.userId;

    const result = await pool.query(
      `
      SELECT i.id, i.code, i.server_id, i.role_to_grant, i.max_uses, i.uses_count, i.expires_at, i.revoked_at,
             s.name AS server_name
      FROM invites i
      JOIN servers s ON s.id = i.server_id
      WHERE i.code = $1
      `,
      [params.code]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: 'Invite not found' });
    }

    const invite = result.rows[0];
    const isMember = await requireServerMembership(userId, invite.server_id);

    return {
      invite: {
        ...invite,
        is_member: isMember
      }
    };
  });

  app.post('/api/invites/:code/accept', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { code: string };
    const userId = request.authUser!.userId;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const inviteResult = await client.query(
        `
        SELECT id, server_id, role_to_grant, max_uses, uses_count, expires_at, revoked_at
        FROM invites
        WHERE code = $1
        FOR UPDATE
        `,
        [params.code]
      );

      if (inviteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Invite not found' });
      }

      const invite = inviteResult.rows[0];

      if (invite.revoked_at) {
        await client.query('ROLLBACK');
        return reply.code(410).send({ error: 'Invite revoked' });
      }

      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        await client.query('ROLLBACK');
        return reply.code(410).send({ error: 'Invite expired' });
      }

      if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
        await client.query('ROLLBACK');
        return reply.code(410).send({ error: 'Invite usage limit reached' });
      }

      await client.query(
        `
        INSERT INTO memberships (user_id, server_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, server_id)
        DO NOTHING
        `,
        [userId, invite.server_id, invite.role_to_grant]
      );

      await client.query(
        `
        UPDATE invites
        SET uses_count = uses_count + 1
        WHERE id = $1
        `,
        [invite.id]
      );

      await client.query('COMMIT');
      return { ok: true, serverId: invite.server_id };
    } catch (error) {
      await client.query('ROLLBACK');
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to accept invite' });
    } finally {
      client.release();
    }
  });

  app.get('/api/servers/:serverId/invites', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const userId = request.authUser!.userId;
    const isAdmin = await requireServerRole(userId, params.serverId, 'admin');

    if (!isAdmin) {
      return reply.code(403).send({ error: 'Admin role required' });
    }

    const result = await pool.query(
      `
      SELECT id, code, role_to_grant, max_uses, uses_count, expires_at, revoked_at, created_at
      FROM invites
      WHERE server_id = $1
      ORDER BY created_at DESC
      `,
      [params.serverId]
    );

    return { invites: result.rows };
  });

  app.post('/api/servers/:serverId/invites', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string };
    const parsed = createInviteSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const isAdmin = await requireServerRole(userId, params.serverId, 'admin');

    if (!isAdmin) {
      return reply.code(403).send({ error: 'Admin role required' });
    }

    const code = randomBytes(8).toString('base64url');
    const expiresAt = parsed.data.expiresInHours
      ? new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const result = await pool.query(
      `
      INSERT INTO invites (server_id, code, created_by_user_id, role_to_grant, max_uses, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, code, role_to_grant, max_uses, uses_count, expires_at, revoked_at, created_at
      `,
      [params.serverId, code, userId, parsed.data.roleToGrant, parsed.data.maxUses ?? null, expiresAt]
    );

    return reply.code(201).send({ invite: result.rows[0] });
  });

  app.delete('/api/servers/:serverId/invites/:inviteId', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { serverId: string; inviteId: string };
    const userId = request.authUser!.userId;
    const isAdmin = await requireServerRole(userId, params.serverId, 'admin');

    if (!isAdmin) {
      return reply.code(403).send({ error: 'Admin role required' });
    }

    await pool.query(
      `
      UPDATE invites
      SET revoked_at = NOW()
      WHERE id = $1
        AND server_id = $2
      `,
      [params.inviteId, params.serverId]
    );

    return { ok: true };
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

    const canManageChannels = await requireServerRole(userId, params.serverId, 'member');

    if (!canManageChannels) {
      return reply.code(403).send({ error: 'Server membership required' });
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

  app.put('/api/channels/:channelId', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { channelId: string };
    const parsed = updateChannelSchema.safeParse(request.body);

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

    const channelSlug = slugify(parsed.data.name);

    try {
      const result = await pool.query(
        `
        UPDATE channels
        SET name = $2, slug = $3
        WHERE id = $1
        RETURNING id, server_id, name, slug, topic, created_at
        `,
        [params.channelId, parsed.data.name, channelSlug]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'Channel not found' });
      }

      return { channel: result.rows[0] };
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: 'Channel slug already exists for this server' });
    }
  });

  app.get('/api/dms', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;

    const result = await pool.query(
      `
      SELECT dc.id,
             u.id AS other_user_id,
             u.handle AS other_handle,
             u.name AS other_name,
             COALESCE(NULLIF(u.avatar_thumb_url, ''), NULLIF(u.avatar_url, '')) AS other_avatar_url,
             COALESCE(unread.unread_count, 0)::int AS unread_count,
             latest.last_message_at
      FROM dm_conversations dc
      JOIN users u ON u.id = CASE WHEN dc.user_a_id = $1 THEN dc.user_b_id ELSE dc.user_a_id END
      LEFT JOIN dm_read_states drs
        ON drs.conversation_id = dc.id
       AND drs.user_id = $1
      LEFT JOIN LATERAL (
        SELECT MAX(dm.created_at) AS last_message_at
        FROM dm_messages dm
        WHERE dm.conversation_id = dc.id
      ) latest ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(dm.id)::int AS unread_count
        FROM dm_messages dm
        WHERE dm.conversation_id = dc.id
          AND dm.author_user_id <> $1
          AND (drs.last_read_at IS NULL OR dm.created_at > drs.last_read_at)
      ) unread ON TRUE
      WHERE dc.user_a_id = $1 OR dc.user_b_id = $1
      ORDER BY latest.last_message_at DESC NULLS LAST, u.handle ASC
      `,
      [userId]
    );

    return { conversations: result.rows };
  });

  app.post('/api/dms', { preHandler: authGuard }, async (request, reply) => {
    const parsed = createDmConversationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const targetHandle = parsed.data.handle.toLowerCase();

    const targetResult = await pool.query(
      `
      SELECT id, handle, name, COALESCE(NULLIF(avatar_thumb_url, ''), NULLIF(avatar_url, '')) AS avatar_url
      FROM users
      WHERE LOWER(handle) = $1
      `,
      [targetHandle]
    );

    if (targetResult.rowCount === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const otherUser = targetResult.rows[0];
    if (otherUser.id === userId) {
      return reply.code(400).send({ error: 'You cannot DM yourself' });
    }

    const [userAId, userBId] =
      userId < (otherUser.id as string)
        ? [userId, otherUser.id as string]
        : [otherUser.id as string, userId];

    const created = await pool.query(
      `
      INSERT INTO dm_conversations (user_a_id, user_b_id, created_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_a_id, user_b_id) DO NOTHING
      RETURNING id
      `,
      [userAId, userBId, userId]
    );

    let conversationId = created.rows[0]?.id as string | undefined;
    if (!conversationId) {
      const existing = await pool.query(
        `
        SELECT id
        FROM dm_conversations
        WHERE user_a_id = $1 AND user_b_id = $2
        `,
        [userAId, userBId]
      );
      conversationId = existing.rows[0]?.id as string | undefined;
    }

    if (!conversationId) {
      return reply.code(500).send({ error: 'Failed to create DM conversation' });
    }

    return reply.code(201).send({
      conversation: {
        id: conversationId,
        other_user_id: otherUser.id,
        other_handle: otherUser.handle,
        other_name: otherUser.name,
        other_avatar_url: otherUser.avatar_url,
        unread_count: 0
      }
    });
  });

  app.get('/api/dms/:conversationId/messages', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { conversationId: string };
    const userId = request.authUser!.userId;

    const isParticipant = await requireDmParticipant(userId, params.conversationId);
    if (!isParticipant) {
      return reply.code(404).send({ error: 'DM conversation not found' });
    }

    const result = await pool.query(
      `
      SELECT dm.id,
             dm.body,
             dm.author_user_id,
             dm.edited_at,
             dm.created_at,
             u.handle AS author_handle,
             u.name AS author_name,
             COALESCE(NULLIF(u.avatar_thumb_url, ''), NULLIF(u.avatar_url, '')) AS author_avatar_url
      FROM dm_messages dm
      JOIN users u ON u.id = dm.author_user_id
      WHERE dm.conversation_id = $1
      ORDER BY dm.created_at ASC
      `,
      [params.conversationId]
    );

    return {
      messages: result.rows.map((row) => ({
        ...row,
        reactions: [],
        attachments: [],
        thread_root_message_id: null,
        thread_reply_count: 0
      }))
    };
  });

  app.post('/api/dms/:conversationId/messages', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { conversationId: string };
    const parsed = createDirectMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const isParticipant = await requireDmParticipant(userId, params.conversationId);
    if (!isParticipant) {
      return reply.code(404).send({ error: 'DM conversation not found' });
    }

    const inserted = await pool.query(
      `
      INSERT INTO dm_messages (conversation_id, author_user_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, body, author_user_id, edited_at, created_at
      `,
      [params.conversationId, userId, parsed.data.body]
    );

    return reply.code(201).send({ message: inserted.rows[0] });
  });

  app.post('/api/dms/:conversationId/read', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { conversationId: string };
    const parsed = markReadSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const isParticipant = await requireDmParticipant(userId, params.conversationId);
    if (!isParticipant) {
      return reply.code(404).send({ error: 'DM conversation not found' });
    }

    await pool.query(
      `
      INSERT INTO dm_read_states (user_id, conversation_id, last_read_message_id, last_read_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, conversation_id)
      DO UPDATE SET
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_at = NOW()
      `,
      [userId, params.conversationId, parsed.data.lastReadMessageId ?? null]
    );

    return { ok: true };
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

    const canManageCommands = await requireServerRole(userId, params.serverId, 'admin');

    if (!canManageCommands) {
      return reply.code(403).send({ error: 'Admin role required' });
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
      WITH search_input AS (
        SELECT websearch_to_tsquery('english', $2) AS query
      )
      SELECT m.id, m.server_id, m.channel_id, m.author_user_id, m.body, m.created_at,
             u.name AS author_name, u.handle AS author_handle,
             c.name AS channel_name, s.name AS server_name,
             ts_rank_cd(to_tsvector('english', COALESCE(m.body, '')), search_input.query) AS relevance
      FROM messages m
      CROSS JOIN search_input
      JOIN users u ON u.id = m.author_user_id
      JOIN channels c ON c.id = m.channel_id
      JOIN servers s ON s.id = m.server_id
      JOIN memberships ms ON ms.server_id = m.server_id AND ms.user_id = $1
      WHERE (
        to_tsvector('english', COALESCE(m.body, '')) @@ search_input.query
        OR m.body ILIKE '%' || $2 || '%'
      )
        AND ($3::uuid IS NULL OR m.server_id = $3::uuid)
        AND ($4::uuid IS NULL OR m.channel_id = $4::uuid)
      ORDER BY
        CASE
          WHEN to_tsvector('english', COALESCE(m.body, '')) @@ search_input.query THEN 0
          ELSE 1
        END,
        relevance DESC,
        m.created_at DESC
      LIMIT $5
      `,
      [userId, q, serverId, channelId, limit]
    );

    return { results: result.rows };
  });

  app.get('/api/library/items', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.authUser!.userId;
    const query = request.query as { serverId?: string; channelId?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 200), 500);

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
             li.source_message_id,
             COALESCE(m.created_at, li.created_at) AS post_time,
             li.posted_by_user_id, u.handle AS posted_by_handle, u.name AS posted_by_name,
             mi.public_url AS media_url,
             lp.title AS preview_title, lp.description AS preview_description, lp.image_url AS preview_image_url
      FROM library_items li
      JOIN channels c ON c.id = li.channel_id
      JOIN users u ON u.id = li.posted_by_user_id
      LEFT JOIN messages m ON m.id = li.source_message_id
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

  const updateLibraryItemMetadataHandler = async (request: any, reply: any) => {
    const params = request.params as { itemId: string };
    const parsed = updateLibraryItemMetadataSchema.safeParse(request.body);
    const userId = request.authUser!.userId;

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const itemResult = await pool.query(
      `
      SELECT id, server_id
      FROM library_items
      WHERE id = $1
      `,
      [params.itemId]
    );

    if (itemResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Library item not found' });
    }

    const item = itemResult.rows[0];
    const isMember = await requireServerMembership(userId, item.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    const normalizedTerms =
      parsed.data.taxonomyTerms?.map((term) => term.trim().toLowerCase()).filter((term) => term.length > 0) ?? undefined;

    const dedupedTerms = normalizedTerms ? [...new Set(normalizedTerms)] : undefined;

    const result = await pool.query(
      `
      UPDATE library_items
      SET title = COALESCE($2, title),
          description = COALESCE($3, description),
          taxonomy_terms = COALESCE($4, taxonomy_terms)
      WHERE id = $1
      RETURNING id, title, description, taxonomy_terms
      `,
      [params.itemId, parsed.data.title ?? null, parsed.data.description ?? null, dedupedTerms ?? null]
    );

    return { item: result.rows[0] };
  };

  // Keep PATCH as primary route while supporting PUT/POST aliases for older clients/reverse proxies.
  app.patch('/api/library/items/:itemId', { preHandler: authGuard }, updateLibraryItemMetadataHandler);
  app.put('/api/library/items/:itemId', { preHandler: authGuard }, updateLibraryItemMetadataHandler);
  app.post('/api/library/items/:itemId/metadata', { preHandler: authGuard }, updateLibraryItemMetadataHandler);

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

    if (parsed.data.visibility === 'public') {
      const isAdmin = await requireServerRole(userId, parsed.data.serverId, 'admin');

      if (!isAdmin) {
        return reply.code(403).send({ error: 'Admin role required for public collections' });
      }
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
             c.name AS channel_name,
             li.source_message_id,
             COALESCE(m.created_at, li.created_at) AS post_time,
             li.posted_by_user_id, u.handle AS posted_by_handle, u.name AS posted_by_name,
             mi.public_url AS media_url,
             lp.title AS preview_title,
             lp.description AS preview_description,
             lp.image_url AS preview_image_url
      FROM collection_items ci
      JOIN library_items li ON li.id = ci.library_item_id
      JOIN channels c ON c.id = li.channel_id
      JOIN users u ON u.id = li.posted_by_user_id
      LEFT JOIN messages m ON m.id = li.source_message_id
      LEFT JOIN media_items mi ON mi.id = li.media_item_id
      LEFT JOIN link_previews lp ON lp.url = li.url
      WHERE ci.collection_id = $1
      ORDER BY ci.sort_order ASC, ci.created_at ASC
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
        INSERT INTO collection_items (collection_id, library_item_id, added_by_user_id, sort_order)
        VALUES (
          $1,
          $2,
          $3,
          COALESCE((SELECT MAX(ci.sort_order) + 1 FROM collection_items ci WHERE ci.collection_id = $1), 1)
        )
        ON CONFLICT DO NOTHING
        `,
        [params.collectionId, item.id, userId]
      );
    }

    return { added: validItems.rows.length };
  });

  app.delete('/api/library/collections/:collectionId/items', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { collectionId: string };
    const parsed = removeCollectionItemsSchema.safeParse(request.body);
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

    const removed = await pool.query(
      `
      DELETE FROM collection_items
      WHERE collection_id = $1
        AND library_item_id = ANY($2::uuid[])
      `,
      [params.collectionId, parsed.data.libraryItemIds]
    );

    return { removed: removed.rowCount ?? 0 };
  });

  app.patch('/api/library/collections/:collectionId/items/order', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { collectionId: string };
    const parsed = reorderCollectionItemsSchema.safeParse(request.body);
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

    const expectedCountResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM collection_items
      WHERE collection_id = $1
      `,
      [params.collectionId]
    );

    const matchedCountResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM collection_items
      WHERE collection_id = $1
        AND library_item_id = ANY($2::uuid[])
      `,
      [params.collectionId, parsed.data.libraryItemIds]
    );

    const expectedCount = Number(expectedCountResult.rows[0]?.count ?? 0);
    const matchedCount = Number(matchedCountResult.rows[0]?.count ?? 0);

    if (expectedCount !== parsed.data.libraryItemIds.length || matchedCount !== expectedCount) {
      return reply.code(400).send({ error: 'libraryItemIds must include each collection item exactly once' });
    }

    await pool.query(
      `
      WITH incoming AS (
        SELECT * FROM unnest($2::uuid[]) WITH ORDINALITY AS t(library_item_id, position)
      )
      UPDATE collection_items ci
      SET sort_order = incoming.position::int
      FROM incoming
      WHERE ci.collection_id = $1
        AND ci.library_item_id = incoming.library_item_id
      `,
      [params.collectionId, parsed.data.libraryItemIds]
    );

    return { updated: parsed.data.libraryItemIds.length };
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
             COALESCE(NULLIF(u.avatar_thumb_url, ''), NULLIF(u.avatar_url, '')) AS author_avatar_url,
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

  app.patch('/api/messages/:messageId', { preHandler: authGuard }, async (request, reply) => {
    const params = request.params as { messageId: string };
    const parsed = updateMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;

    const messageResult = await pool.query(
      `
      SELECT id, server_id, channel_id, author_user_id
      FROM messages
      WHERE id = $1
      `,
      [params.messageId]
    );

    if (messageResult.rowCount === 0) {
      return reply.code(404).send({ error: 'Message not found' });
    }

    const message = messageResult.rows[0];
    const isMember = await requireServerMembership(userId, message.server_id);

    if (!isMember) {
      return reply.code(403).send({ error: 'Not a server member' });
    }

    if (message.author_user_id !== userId) {
      return reply.code(403).send({ error: 'Only the original author can edit this message' });
    }

    const updated = await pool.query(
      `
      UPDATE messages
      SET body = $2, edited_at = NOW()
      WHERE id = $1
      RETURNING id, channel_id, author_user_id, body, reply_to_message_id, thread_root_message_id, edited_at, created_at
      `,
      [params.messageId, parsed.data.body]
    );

    return { message: updated.rows[0] };
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
             COALESCE(NULLIF(u.avatar_thumb_url, ''), NULLIF(u.avatar_url, '')) AS author_avatar_url,
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
             COUNT(m.id)::int AS unread_count,
             COUNT(m.id) FILTER (
               WHERE POSITION(('@' || LOWER(viewer.handle)) IN LOWER(m.body)) > 0
             )::int AS mention_count
      FROM memberships ms
      JOIN users viewer ON viewer.id = ms.user_id
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
