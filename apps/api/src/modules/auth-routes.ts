import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { authGuard } from '../lib/auth-guard.js';
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

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8)
});

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function generateRefreshToken() {
  return randomBytes(48).toString('hex');
}

function generatePasswordResetToken() {
  return randomBytes(48).toString('hex');
}

function computeRefreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.refreshTokenDays);
  return expiresAt;
}

async function createSession(userId: string, userAgent?: string, ipAddress?: string) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = computeRefreshExpiry();

  await pool.query(
    `
    INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, refreshTokenHash, userAgent ?? null, ipAddress ?? null, expiresAt.toISOString()]
  );

  return refreshToken;
}

async function recordLoginAttempt(identifier: string, success: boolean) {
  await pool.query(
    `
    INSERT INTO login_attempts (identifier, success)
    VALUES ($1, $2)
    `,
    [identifier, success]
  );
}

async function isRateLimited(identifier: string) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS failed_attempts
    FROM login_attempts
    WHERE identifier = $1
      AND success = false
      AND created_at > NOW() - ($2::int * INTERVAL '1 minute')
    `,
    [identifier, config.authAttemptWindowMinutes]
  );

  const attempts = result.rows[0]?.failed_attempts ?? 0;
  return attempts >= config.authMaxAttemptsPerWindow;
}

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
        RETURNING id, email, handle, name, avatar_url, avatar_thumb_url, bio, home_server_id
        `,
        [data.email.toLowerCase(), normalizedHandle, data.name, passwordHash]
      );

      const user = result.rows[0];
      const accessToken = signAccessToken({ userId: user.id, email: user.email });
      const refreshToken = await createSession(
        user.id,
        request.headers['user-agent'] as string | undefined,
        request.ip
      );

      return reply.send({
        token: accessToken,
        accessToken,
        refreshToken,
        user
      });
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
    const identifier = `${data.email.toLowerCase()}|${request.ip}`;
    const limited = await isRateLimited(identifier);

    if (limited) {
      return reply.code(429).send({
        error: `Too many failed attempts. Try again in ${config.authAttemptWindowMinutes} minutes.`
      });
    }

    const result = await pool.query(
      `
      SELECT id, email, handle, name, avatar_url, avatar_thumb_url, bio, home_server_id, password_hash
      FROM users
      WHERE email = $1
      `,
      [data.email.toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      await recordLoginAttempt(identifier, false);
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(data.password, user.password_hash);

    if (!isValid) {
      await recordLoginAttempt(identifier, false);
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    await recordLoginAttempt(identifier, true);

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = await createSession(
      user.id,
      request.headers['user-agent'] as string | undefined,
      request.ip
    );

    return reply.send({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        name: user.name,
        avatar_url: user.avatar_url,
        avatar_thumb_url: user.avatar_thumb_url,
        home_server_id: user.home_server_id,
        bio: user.bio
      }
    });
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const refreshTokenHash = hashToken(parsed.data.refreshToken);

    const sessionResult = await pool.query(
      `
      SELECT s.id, s.user_id, u.email, u.handle, u.name, u.avatar_url, u.avatar_thumb_url, u.home_server_id, u.bio
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.refresh_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      `,
      [refreshTokenHash]
    );

    if (sessionResult.rowCount === 0) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const session = sessionResult.rows[0];
    const nextRefreshToken = generateRefreshToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const nextExpiry = computeRefreshExpiry();

    await pool.query(
      `
      UPDATE auth_sessions
      SET refresh_token_hash = $2,
          expires_at = $3
      WHERE id = $1
      `,
      [session.id, nextRefreshTokenHash, nextExpiry.toISOString()]
    );

    const accessToken = signAccessToken({ userId: session.user_id, email: session.email });

    return reply.send({
      token: accessToken,
      accessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: session.user_id,
        email: session.email,
        handle: session.handle,
        name: session.name,
        avatar_url: session.avatar_url,
        avatar_thumb_url: session.avatar_thumb_url,
        home_server_id: session.home_server_id,
        bio: session.bio
      }
    });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const parsed = logoutSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const refreshTokenHash = hashToken(parsed.data.refreshToken);

    await pool.query(
      `
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL
      `,
      [refreshTokenHash]
    );

    return { ok: true };
  });

  app.post('/api/auth/logout-all', { preHandler: authGuard }, async (request) => {
    const userId = request.authUser!.userId;

    await pool.query(
      `
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId]
    );

    return { ok: true };
  });

  app.post('/api/auth/change-password', { preHandler: authGuard }, async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.authUser!.userId;
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.password_hash);
    if (!ok) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, nextHash]);
    await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);

    return { ok: true };
  });

  app.post('/api/auth/forgot-password', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const email = parsed.data.email.toLowerCase();
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    // Always return success to avoid account enumeration.
    if (userResult.rowCount === 0) {
      return { ok: true };
    }

    const userId = userResult.rows[0].id as string;
    const rawToken = generatePasswordResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await pool.query(
      `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [userId, tokenHash, expiresAt.toISOString()]
    );

    // Security default: do not expose reset token in API responses.
    // Optional self-host shortcut can be explicitly enabled via env.
    if (config.authExposeResetToken) {
      return { ok: true, resetToken: rawToken, expiresAt: expiresAt.toISOString() };
    }

    return { ok: true };
  });

  app.post('/api/auth/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const tokenHash = hashToken(parsed.data.token);
    const tokenResult = await pool.query(
      `
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      `,
      [tokenHash]
    );

    if (tokenResult.rowCount === 0) {
      return reply.code(400).send({ error: 'Reset token is invalid or expired' });
    }

    const reset = tokenResult.rows[0];
    const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await pool.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [reset.user_id, nextHash]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [reset.user_id]);
    await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [reset.user_id]);

    return { ok: true };
  });
}
