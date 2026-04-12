import { FastifyInstance } from 'fastify';
import { z } from 'zod';

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
  replyToMessageId: z.string().uuid().optional()
});

const markReadSchema = z.object({
  lastReadMessageId: z.string().uuid().optional()
});

const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(20)
});

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
      SELECT m.id, m.channel_id, m.author_user_id, m.body, m.reply_to_message_id,
             m.edited_at, m.created_at,
             u.handle AS author_handle,
             u.name AS author_name,
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

    const result = await pool.query(
      `
      INSERT INTO messages (server_id, channel_id, author_user_id, body, reply_to_message_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, channel_id, author_user_id, body, reply_to_message_id, edited_at, created_at
      `,
      [channel.server_id, params.channelId, userId, parsed.data.body, parsed.data.replyToMessageId ?? null]
    );

    return reply.code(201).send({ message: result.rows[0] });
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
      LEFT JOIN read_states rs ON rs.user_id = ms.user_id AND rs.channel_id = c.id
      LEFT JOIN messages m ON m.channel_id = c.id
        AND (
          rs.last_read_at IS NULL
          OR m.created_at > rs.last_read_at
        )
      WHERE ms.user_id = $1
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
