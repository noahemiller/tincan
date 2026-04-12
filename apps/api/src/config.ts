import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://tincan:tincan@localhost:5432/tincan',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  uploadsBaseUrl: process.env.UPLOADS_BASE_URL ?? 'http://localhost:4000/uploads',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 30),
  authMaxAttemptsPerWindow: Number(process.env.AUTH_MAX_ATTEMPTS_PER_WINDOW ?? 8),
  authAttemptWindowMinutes: Number(process.env.AUTH_ATTEMPT_WINDOW_MINUTES ?? 15),
  linkPreviewTtlHours: Number(process.env.LINK_PREVIEW_TTL_HOURS ?? 168),
  linkPreviewRefreshIntervalMs: Number(process.env.LINK_PREVIEW_REFRESH_INTERVAL_MS ?? 60000),
  linkPreviewRefreshBatchSize: Number(process.env.LINK_PREVIEW_REFRESH_BATCH_SIZE ?? 20),
  linkPreviewRetryBaseMinutes: Number(process.env.LINK_PREVIEW_RETRY_BASE_MINUTES ?? 15),
  linkPreviewRetryMaxMinutes: Number(process.env.LINK_PREVIEW_RETRY_MAX_MINUTES ?? 1440)
};
