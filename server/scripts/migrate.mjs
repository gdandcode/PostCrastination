import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { localConfig } from '../src/config.mjs';

export async function migrate() {
  const c = localConfig();
  const client = new pg.Client({ host: '127.0.0.1', port: c.port, user: 'postgres', password: c.adminPassword, database: 'postcrastination', connectionTimeoutMillis: 3000 });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(72591001)');
    await client.query('SET ROLE rptpc_owner');
    await client.query('CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION rptpc_owner');
    await client.query('CREATE TABLE IF NOT EXISTS app.schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const dir = new URL('../migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter(f => /^\d+_.+\.sql$/.test(f)).sort()) {
      const sql = await readFile(new URL(file, dir), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query('SELECT checksum FROM app.schema_migrations WHERE version=$1', [file]);
      if (previous.rowCount) {
        if (previous.rows[0].checksum !== checksum) throw new Error(`Applied migration was changed: ${file}. Add a new migration instead.`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO app.schema_migrations(version, checksum) VALUES ($1,$2)', [file, checksum]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    console.log('Database schema is up to date.');
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch(() => { console.error('Migration failed. Check the database and migration files.'); process.exitCode = 1; });
}
