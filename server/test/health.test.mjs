import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';

async function withServer(pool, callback) {
  const server = createApp(pool);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('readiness checks the database and returns the migration version', async () => {
  let queried = false;
  await withServer({ query: async () => { queried = true; return { rows: [{ version: '001_foundation.sql' }] }; } }, async url => {
    const res = await fetch(url + '/api/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).database, 'connected');
    assert.equal(queried, true);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });
});
test('database failures return 503 without exposing diagnostic secrets', async () => {
  await withServer({ query: async () => { throw new Error('password=SECRET'); } }, async url => {
    const res = await fetch(url + '/api/health');
    assert.equal(res.status, 503);
    assert.equal((await res.text()).includes('SECRET'), false);
  });
});
test('unexpected routes and methods cannot write application data', async () => {
  await withServer({ query: async () => { throw new Error('must not query'); } }, async url => {
    assert.equal((await fetch(url + '/api/classes')).status, 404);
    const res = await fetch(url + '/api/health', { method: 'POST' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET');
  });
});
test('school data and mutations require a verified identity', async () => {
  await withServer({connect:async()=>{throw new Error('unauthenticated request reached database');}},async url=>{
    assert.equal((await fetch(url+'/api/school')).status,401);
    assert.equal((await fetch(url+'/api/school/classes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Not allowed'})})).status,401);
  });
});
