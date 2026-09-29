import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, useStore } from '../server/store.js';
import { routes } from '../server/api.js';
import { sign } from '../server/core.js';

const register = { POST: routes['POST /api/register'] };
const login = { POST: routes['POST /api/login'] };
const me = { GET: routes['GET /api/me'] };
const runs = { POST: routes['POST /api/runs'] };
const scores = { POST: routes['POST /api/scores'], GET: routes['GET /api/scores'] };

const call = async (handler, { method = 'POST', body, token, query = '' } = {}) => {
  const headers = { 'content-type': 'application/json', 'x-arcade-client-ip': '203.0.113.7' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await handler(new Request(`http://arcade.test/api/x${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
};
const signup = async (username = 'Mouton', password = 'correct horse') => (await call(register.POST, { body: { username, password } })).data;

beforeEach(() => useStore(memoryStore()));

test('register, login and me round-trip', async () => {
  const created = await call(register.POST, { body: { username: '  Tank  Driver ', password: 'hunter2hunter2' } });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.username, 'Tank Driver');
  assert.ok(!('hash' in created.data.user) && !('salt' in created.data.user), 'password material leaked');

  const bad = await call(login.POST, { body: { username: 'tank driver', password: 'nope-nope' } });
  assert.equal(bad.status, 401);
  const ok = await call(login.POST, { body: { username: 'TANK DRIVER', password: 'hunter2hunter2' } });
  assert.equal(ok.status, 200);

  const profile = await call(me.GET, { method: 'GET', token: ok.data.token });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.username, 'Tank Driver');
  assert.equal(profile.data.best['stack-panic'], 0);
});

test('usernames are unique case-insensitively and validated', async () => {
  await signup('Canard');
  assert.equal((await call(register.POST, { body: { username: 'CANARD', password: 'whatever123' } })).status, 409);
  assert.equal((await call(register.POST, { body: { username: 'ab', password: 'whatever123' } })).status, 400);
  assert.equal((await call(register.POST, { body: { username: 'Valid', password: 'short' } })).status, 400);
  assert.equal((await call(register.POST, { body: { username: '<script>', password: 'whatever123' } })).status, 400);
});

test('scores need a session and a fresh single-use run', async () => {
  const { token } = await signup();
  assert.equal((await call(runs.POST, { body: { game: 'stack-panic' } })).status, 401);
  assert.equal((await call(runs.POST, { token, body: { game: 'hivebound' } })).status, 400);

  // Forge a run that started a minute ago so the plausibility cap allows the score.
  const run = await call(runs.POST, { token, body: { game: 'stack-panic', daily: true } });
  assert.equal(run.status, 201);
  const payload = JSON.parse(Buffer.from(run.data.runToken.split('.')[0], 'base64url'));
  const aged = sign({ ...payload, t: Date.now() - 60_000 });

  const first = await call(scores.POST, { token, body: { runToken: aged, score: 12000 } });
  assert.equal(first.status, 201);
  assert.deepEqual([first.data.rank, first.data.dailyRank, first.data.newBest], [1, 1, true]);
  assert.equal((await call(scores.POST, { token, body: { runToken: aged, score: 13000 } })).status, 409, 'run token reused');

  const board = await call(scores.GET, { method: 'GET', query: '?game=stack-panic&daily=1' });
  assert.deepEqual(board.data.scores, [{ rank: 1, username: 'Mouton', score: 12000 }]);
});

test('implausible or foreign runs are refused', async () => {
  const a = await signup('Alice');
  const b = await signup('Bob');
  const run = (await call(runs.POST, { token: a.token, body: { game: 'stack-panic' } })).data.runToken;
  assert.equal((await call(scores.POST, { token: b.token, body: { runToken: run, score: 10 } })).status, 400, 'run stolen by another player');
  assert.equal((await call(scores.POST, { token: a.token, body: { runToken: run, score: 9_000_000 } })).status, 400, 'instant huge score accepted');
  assert.equal((await call(scores.POST, { token: a.token, body: { runToken: run + 'x', score: 10 } })).status, 400, 'tampered run accepted');
});

test('leaderboard keeps each player best and sorts descending', async () => {
  const players = [['Alice', 500], ['Bob', 3000], ['Carol', 1200]];
  for (const [name, score] of players) {
    const { token } = await signup(name);
    for (const s of [score, Math.floor(score / 2)]) {
      const run = (await call(runs.POST, { token, body: { game: 'stack-panic' } })).data.runToken;
      await call(scores.POST, { token, body: { runToken: run, score: s } });
    }
  }
  const board = await call(scores.GET, { method: 'GET', query: '?game=stack-panic' });
  assert.deepEqual(board.data.scores.map(s => [s.username, s.score]), [['Bob', 3000], ['Carol', 1200], ['Alice', 500]]);
});

test('login is rate limited per IP', async () => {
  await signup();
  let last;
  for (let i = 0; i < 21; i++) last = await call(login.POST, { body: { username: 'Mouton', password: 'wrong-password' } });
  assert.equal(last.status, 429);
});

test('malformed multi-byte token signatures are rejected with 401, not a crash', async () => {
  const { token } = await signup('Glyphe');
  const [body] = token.split('.');
  const forged = `${body}.${'é'.repeat(43)}`;
  assert.equal((await call(me.GET, { method: 'GET', token: forged })).status, 401);
});

test('a daily leaderboard can be read for the day the run was filed under', async () => {
  const { token } = await signup('Minuit');
  const run = (await call(runs.POST, { token, body: { game: 'stack-panic', daily: true } })).data.runToken;
  const payload = JSON.parse(Buffer.from(run.split('.')[0], 'base64url'));
  const lateRun = sign({ ...payload, day: '2026-09-28', t: Date.now() - 60_000 });
  const res = await call(scores.POST, { token, body: { runToken: lateRun, score: 500 } });
  assert.equal(res.data.day, '2026-09-28');
  const board = await call(scores.GET, { method: 'GET', query: '?game=stack-panic&daily=1&day=2026-09-28' });
  assert.deepEqual(board.data.scores.map(s => s.username), ['Minuit']);
  assert.equal((await call(scores.GET, { method: 'GET', query: '?game=stack-panic&daily=1&day=../../x' })).status, 200, 'bad day param should fall back to today');
});

test('a score submission can be retried safely, but a run cannot change its score', async () => {
  const { token } = await signup('Retente');
  const opened = await call(runs.POST, { token, body: { game: 'stack-panic' } });
  assert.match(opened.data.day, /^\d{4}-\d{2}-\d{2}$/, 'run start should return the server day');
  const payload = JSON.parse(Buffer.from(opened.data.runToken.split('.')[0], 'base64url'));
  const aged = sign({ ...payload, t: Date.now() - 60_000 });
  assert.equal((await call(scores.POST, { token, body: { runToken: aged, score: 4200 } })).status, 201);
  assert.equal((await call(scores.POST, { token, body: { runToken: aged, score: 4200 } })).status, 201, 'identical retry refused');
  assert.equal((await call(scores.POST, { token, body: { runToken: aged, score: 9000 } })).status, 409, 'run score was changed');
});

test('a failed registration (missing secret) does not consume the username', async () => {
  const saved = { env: process.env.NODE_ENV, secret: process.env.ARCADE_SECRET };
  process.env.NODE_ENV = 'production'; delete process.env.ARCADE_SECRET;
  try {
    assert.equal((await call(register.POST, { body: { username: 'Secretless', password: 'whatever123' } })).status, 503);
  } finally {
    process.env.NODE_ENV = saved.env; if (saved.secret) process.env.ARCADE_SECRET = saved.secret;
  }
  assert.equal((await call(register.POST, { body: { username: 'Secretless', password: 'whatever123' } })).status, 201, 'name was consumed by the failed attempt');
});

test('best and newBest reflect the committed leaderboard value', async () => {
  const { token } = await signup('Concurrent');
  const open = async () => {
    const p = JSON.parse(Buffer.from((await call(runs.POST, { token, body: { game: 'stack-panic' } })).data.runToken.split('.')[0], 'base64url'));
    return sign({ ...p, t: Date.now() - 120_000 });
  };
  const [a, b] = [await open(), await open()];
  await call(scores.POST, { token, body: { runToken: a, score: 9000 } });
  const low = await call(scores.POST, { token, body: { runToken: b, score: 4000 } });
  assert.equal(low.data.best, 9000);
  assert.equal(low.data.newBest, false);
});

test('opening runs is rate limited per account', async () => {
  const { token } = await signup('Spammeur');
  let last;
  for (let i = 0; i < 61; i++) last = await call(runs.POST, { token, body: { game: 'stack-panic' } });
  assert.equal(last.status, 429);
});
