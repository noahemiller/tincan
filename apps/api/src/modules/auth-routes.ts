import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pool } from '../db/pool.js';
import { signAccessToken } from '../lib/jwt.js';
import { slugify } from '../lib/slugify.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80),
  handle: z.string().min(2).max(32)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data;
    const passwordHash = await bcrypt.hash(data.password, 12);
    const normalizedHandle = slugify(data.handle).replace(/-/g, '_');

    try {
      const result = await pool.query(
        `
        INSERT INTO users (email, handle, name, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, handle, name, avatar_url, bio
        `,
        [data.email.toLowerCase(), normalizedHandle, data.name, passwordHash]
      );

      const user = result.rows[0];
      const token = signAccessToken({ userId: user.id, email: user.email });

      return reply.send({ token, user });
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: 'Email or handle already in use' });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data;
    const result = await pool.query(
      `
      SELECT id, email, handle, name, avatar_url, bio, password_hash
      FROM users
      WHERE email = $1
      `,
      [data.email.toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(data.password, user.password_hash);

    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = signAccessToken({ userId: user.id, email: user.email });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        name: user.name,
        avatar_url: user.avatar_url,
        bio: user.bio
      }
    });
  });
}
