import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { pool } from './pool.js';

export async function runMigrations() {
  const schemaPath = resolve(process.cwd(), 'sql', 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
}
