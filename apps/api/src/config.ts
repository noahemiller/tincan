import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://tincan:tincan@localhost:5432/tincan',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173'
};
