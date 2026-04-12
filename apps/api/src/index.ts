import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { registerAppRoutes } from './modules/app-routes.js';
import { registerAuthRoutes } from './modules/auth-routes.js';
import { refreshDueLinkPreviews } from './modules/link-previews.js';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true
  });
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024
    }
  });

  const uploadsRoot = resolve(process.cwd(), config.uploadsDir);
  await mkdir(uploadsRoot, { recursive: true });

  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: '/uploads/'
  });

  await runMigrations();
  await registerAuthRoutes(app);
  await registerAppRoutes(app);

  const previewRefreshTimer = setInterval(() => {
    void (async () => {
      try {
        const result = await refreshDueLinkPreviews(config.linkPreviewRefreshBatchSize);
        if (result.refreshed > 0) {
          app.log.info({ refreshed: result.refreshed }, 'refreshed stale link previews');
        }
      } catch (error) {
        app.log.warn({ error }, 'link preview refresh cycle failed');
      }
    })();
  }, config.linkPreviewRefreshIntervalMs);
  previewRefreshTimer.unref();

  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
