import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import { localDir, localConfig } from '../src/config.mjs';
import { migrate } from './migrate.mjs';

const data = path.join(localDir, 'pgdata');
const bin = path.join(localDir, 'postgres', 'pgsql', 'bin');
const log = path.join(localDir, 'postgres.log');
const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function run(name, args, allowFailure = false) {
  const command = path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', b => { output += b; });
    child.stderr.on('data', b => { output += b; });
    child.on('error', () => reject(new Error('PostgreSQL binaries are missing or cannot run. See server/README.md.')));
    child.on('exit', code => {
      // Windows background PostgreSQL can retain inherited pipe handles.
      // pg_ctl has finished; release our pipes so the launcher can exit.
      child.stdout.destroy();
      child.stderr.destroy();
      if (code && !allowFailure) reject(new Error(`${name} failed (exit ${code}). ${output}`));
      else resolve({ code, output });
    });
  });
}
async function start() {
  localConfig();
  const status = await run('pg_ctl', ['-D', data, 'status'], true);
  if (status.code === 0) { console.log('PostgreSQL is already running.'); return; }
  await run('pg_ctl', ['-D', data, '-l', log, '-w', '-t', '30', 'start']);
  console.log('PostgreSQL started on 127.0.0.1:55432.');
}
async function setup() {
  await mkdir(localDir, { recursive: true });
  const configPath = path.join(localDir, 'database.json');
  if (!await exists(configPath)) {
    if (await exists(path.join(data, 'PG_VERSION'))) throw new Error('Existing database found without credentials. Restore database.json; setup will not overwrite your data.');
    await writeFile(configPath, JSON.stringify({ port: 55432, adminPassword: randomBytes(32).toString('hex'), appPassword: randomBytes(32).toString('hex') }, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const c = localConfig();
  if (!await exists(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(localDir, 'init-password.txt');
    await writeFile(passwordFile, c.adminPassword, { mode: 0o600 });
    try {
      await run('initdb', ['-D', data, '-U', 'postgres', '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256', `--pwfile=${passwordFile}`]);
    } finally { await unlink(passwordFile).catch(() => {}); }
  }
  // Keep the managed cluster bound to loopback, even when setup is resumed.
  await writeFile(path.join(data, 'postgresql.auto.conf'), `# Managed local development settings\nlisten_addresses = '127.0.0.1'\nport = ${c.port}\npassword_encryption = 'scram-sha-256'\n`);
  await start();
  const admin = new pg.Client({ host: '127.0.0.1', port: c.port, user: 'postgres', password: c.adminPassword, database: 'postgres', connectionTimeoutMillis: 3000 });
  await admin.connect();
  try {
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='rptpc_owner'")).rowCount) await admin.query('CREATE ROLE rptpc_owner NOLOGIN');
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='rptpc_app'")).rowCount) {
      // Password is generated hex, never accepted as user-provided SQL.
      if (!/^[a-f0-9]{64}$/.test(c.appPassword)) throw new Error('Invalid generated application credential.');
      await admin.query(`CREATE ROLE rptpc_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${c.appPassword}'`);
    }
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='postcrastination'")).rowCount) await admin.query('CREATE DATABASE postcrastination OWNER rptpc_owner');
    await admin.query('REVOKE ALL ON DATABASE postcrastination FROM PUBLIC');
    await admin.query('GRANT CONNECT ON DATABASE postcrastination TO rptpc_app');
    await admin.query("ALTER ROLE rptpc_app IN DATABASE postcrastination SET search_path TO app, public");
  } finally { await admin.end(); }
  await migrate();
  console.log('Local database ready. Credentials are stored only in server/.local/database.json.');
}
try {
  const action = process.argv[2];
  if (action === 'setup') await setup();
  else if (action === 'start') await start();
  else if (action === 'stop') {
    const status = await run('pg_ctl', ['-D', data, 'status'], true);
    if (status.code === 0) await run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log('PostgreSQL is stopped. Saved data is kept.');
  } else if (action === 'status') {
    const result = await run('pg_ctl', ['-D', data, 'status'], true);
    console.log(result.code === 0 ? 'PostgreSQL is running.' : 'PostgreSQL is stopped.');
    process.exitCode = result.code === 0 ? 0 : 1;
  } else throw new Error('Use setup, start, stop or status.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
