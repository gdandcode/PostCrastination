import assert from 'node:assert/strict';
import pg from 'pg';
import { databaseOptions, apiPort } from '../src/config.mjs';

const client = new pg.Client({ ...databaseOptions(), connectionTimeoutMillis: 3000 });
try {
  await client.connect();
  const { rows: [role] } = await client.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user');
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolcreatedb, false);
  assert.equal(role.rolcreaterole, false);
  await assert.rejects(client.query('DELETE FROM app.schema_migrations'), error => error.code === '42501');
  await assert.rejects(client.query('CREATE TABLE app.connection_probe (value text)'), error => error.code === '42501');
  const response = await fetch(`http://127.0.0.1:${apiPort()}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.database, 'connected');
  assert.equal(health.schemaVersion, '018_resource_management.sql');
  console.log('PASS: live database connection, restricted app account, protected migrations, healthy backend.');
} catch (error) { console.error('Backend verification failed:', error.code || error.message); process.exitCode = 1; }
finally { await client.end(); }
