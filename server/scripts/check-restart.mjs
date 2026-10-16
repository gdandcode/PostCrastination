// Explicit local development check. Requires the backend to be running.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import { databaseOptions, root, apiPort } from '../src/config.mjs';

async function migrationRecords() {
  const c = new pg.Client(databaseOptions());
  await c.connect();
  try { return (await c.query('SELECT version, checksum, applied_at FROM app.schema_migrations ORDER BY version')).rows; }
  finally { await c.end(); }
}
function control(action) {
  const result = spawnSync(process.execPath, ['scripts/local-db.mjs', action], { cwd: root, windowsHide: true, stdio: 'inherit', timeout: 45000 });
  if (result.error || result.status !== 0) throw new Error(`Database ${action} failed.`);
}
const before = await migrationRecords();
try {
  control('stop');
  const down = await fetch(`http://127.0.0.1:${apiPort()}/api/health`);
  assert.equal(down.status, 503);
} finally { control('start'); }
assert.deepEqual(await migrationRecords(), before);
const up = await fetch(`http://127.0.0.1:${apiPort()}/api/health`);
assert.equal(up.status, 200);
console.log('PASS: database restart preserves migration records; backend reports outage and recovers.');
