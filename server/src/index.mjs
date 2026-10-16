import pg from 'pg';
import { verifyRequest } from './auth.mjs';
import { createApp } from './app.mjs';
import { databaseOptions, apiPort } from './config.mjs';

const pool = new pg.Pool({ ...databaseOptions(), max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, statement_timeout: 5000 });
pool.on('error', () => console.error('Database connection interrupted. Check that PostgreSQL is running.'));
try { await pool.query('SELECT version FROM app.schema_migrations LIMIT 1'); }
catch { console.error('Database is not ready. Run npm run db:setup, or db:start and db:migrate.'); await pool.end(); process.exit(1); }
const server = createApp(pool, verifyRequest);
server.requestTimeout = 120000;
server.headersTimeout = 10000;
server.on('error', async error => { console.error(error.code === 'EADDRINUSE' ? 'Backend port is already in use.' : 'Backend could not start.'); await pool.end(); process.exitCode = 1; });
server.listen(apiPort(), '127.0.0.1', () => console.log(`Postcrastination backend: http://127.0.0.1:${apiPort()}/api/health`));
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 5000).unref();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
