import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { memoryStore, useStore } from '../server/store.js';
import { routes } from '../server/api.js';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const games = readdirSync('games').filter(g => existsSync(`games/${g}/public/index.html`));

test('vercel.json routes every cabinet and redirects the retired one', () => {
  for (const g of games) {
    const index = config.rewrites.find(r => r.source === `/${g}/`);
    const files = config.rewrites.find(r => r.source === `/${g}/:path*`);
    assert.equal(index?.destination, `/games/${g}/public/index.html`, `${g} index not routed`);
    assert.equal(files?.destination, `/games/${g}/public/:path*`, `${g} assets not routed`);
    assert.ok(config.redirects.some(r => r.source === `/${g}` && r.destination === `/${g}/`), `${g} bare path not redirected`);
  }
  assert.ok(config.redirects.some(r => r.source === '/hivebound/:path*' && r.destination === '/'));
});

test('every API route has a Vercel function exporting its method', async () => {
  for (const key of Object.keys(routes)) {
    const [method, path] = key.split(' ');
    const mod = await import(`../api/${path.replace('/api/', '')}.js`);
    assert.equal(typeof mod[method], 'function', `${key} missing in api/`);
  }
});

beforeEach(() => useStore(memoryStore()));

test('the Vercel adapter uses the platform IP, not a client-supplied one', async () => {
  const { POST } = await import('../api/login.js');
  const call = headers => POST(new Request('https://arcade.test/api/login', {
    method:'POST', headers:{ 'content-type':'application/json', ...headers }, body:JSON.stringify({ username:'nobody', password:'wrong-password' })
  }));
  // 20 attempts from one real IP exhaust the limit, whatever the spoofed header says.
  let last;
  for (let i = 0; i < 21; i++) last = await call({ 'x-real-ip':'198.51.100.9', 'x-arcade-client-ip':`spoof-${i}` });
  assert.equal(last.status, 429);
  assert.equal((await call({ 'x-real-ip':'198.51.100.10' })).status, 401, 'another IP was rate limited');
});

test('register through the Vercel function round-trips JSON', async () => {
  const { POST } = await import('../api/register.js');
  const res = await POST(new Request('https://arcade.test/api/register', {
    method:'POST', headers:{ 'content-type':'application/json', 'x-real-ip':'203.0.113.50' }, body:JSON.stringify({ username:'Vercelle', password:'vercel-ok-1' })
  }));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).user.username, 'Vercelle');
});
