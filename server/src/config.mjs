import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const localDir = fileURLToPath(new URL('../.local/', import.meta.url));
export function localConfig() {
  try { return JSON.parse(readFileSync(new URL('../.local/database.json', import.meta.url), 'utf8')); }
  catch { throw new Error('Local database is not configured. Run npm run db:setup in server first.'); }
}
export function databaseOptions() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  const c = localConfig();
  return { host: '127.0.0.1', port: c.port, database: 'postcrastination', user: 'rptpc_app', password: c.appPassword };
}
export function apiPort() {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
  return port;
}
