import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from '../server/store.js';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), 'arcade-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, NODE_ENV: 'test' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(base + '/'); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
});
after(() => { proc?.kill('SIGTERM'); rmSync(dataDir, { recursive: true, force: true }); });

const get = path => fetch(base + path, { redirect: 'manual' });

test('serves the landing page, shared files and every cabinet', async () => {
  for (const path of ['/', '/arcade.css', '/shared/account.js', '/stack-panic/', '/stack-panic/core.js', '/forbidden-fruit/', '/pigeon-control/', '/goose-delivery/']) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
  }
  assert.match((await get('/stack-panic/core.js')).headers.get('content-type'), /javascript/);
});

test('redirects bare game paths and retired games', async () => {
  assert.equal((await get('/stack-panic')).headers.get('location'), '/stack-panic/');
  assert.equal((await get('/hivebound/')).headers.get('location'), '/');
});

test('never exposes server code, data or the repository', async () => {
  for (const path of ['/server/core.js', '/package.json', '/tests/api.test.mjs', '/.git/config', '/data/arcade.json',
    '/stack-panic/..%2f..%2f..%2fserver%2fcore.js', '/shared/..%2fserver%2fcore.js', '/games/stack-panic/public/core.js']) {
    assert.equal((await get(path)).status, 404, path);
  }
});

test('API is mounted and the store persists to disk', async () => {
  const res = await fetch(base + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Pigeon', password: 'roucoulade' }) });
  assert.equal(res.status, 201);
  await new Promise(r => setTimeout(r, 500));
  const file = join(dataDir, 'arcade.json');
  assert.ok(existsSync(file), 'store file not written');
  assert.match(readFileSync(file, 'utf8'), /user:pigeon/);
});

test('file store reloads what it saved', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-store-'));
  const file = join(dir, 'db.json');
  const a = fileStore(file);
  await a.setNX('user:x', '{"id":1}');
  await a.zaddGT('lb:g:all', 'X', 42);
  await a.incr('rl:login:1', 60);
  await a.flush();
  const b = fileStore(file);
  assert.equal(await b.get('user:x'), '{"id":1}');
  assert.equal(await b.zscore('lb:g:all', 'X'), 42);
  assert.equal(await b.get('rl:login:1'), null, 'rate-limit counters should not be persisted');
  rmSync(dir, { recursive: true, force: true });
});

test('file store reports a failed snapshot instead of pretending it worked', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-store-'));
  const s = fileStore(join(dir, 'missing-dir', 'nested', 'db.json'));
  await s.setNX('user:x', '1');
  rmSync(dir, { recursive: true, force: true }); // the target directory disappears under the store
  await assert.rejects(s.flush());
});
