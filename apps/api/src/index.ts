import cors from '@fastify/cors';
import Fastify from 'fastify';

import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { registerAppRoutes } from './modules/app-routes.js';
import { registerAuthRoutes } from './modules/auth-routes.js';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true
  });

  await runMigrations();
  await registerAuthRoutes(app);
  await registerAppRoutes(app);

  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
