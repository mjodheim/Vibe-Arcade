import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'data');

async function waitFor(url, attempts=50) {
  for (let i=0;i<attempts;i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Server did not start: ${url}`);
}

async function request(base, path, {method='GET', body, token}={}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? {'content-type':'application/json'} : {}),
      ...(token ? {authorization:`Bearer ${token}`} : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return {status:res.status, data};
}

test('server supports account, run, score, leaderboard and deterministic Daily Hive', async t => {
  await rm(DATA, {recursive:true, force:true});
  const port = 19000 + (process.pid % 1000);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {...process.env, PORT:String(port), HIVEBOUND_SECRET:'automated-test-secret'},
    stdio:['ignore','pipe','pipe']
  });
  t.after(async () => {
    child.kill('SIGTERM');
    await rm(DATA, {recursive:true, force:true});
  });

  await waitFor(`${base}/api/leaderboard`);

  const username = `player-${process.pid}`;
  const registration = await request(base, '/api/register', {
    method:'POST', body:{username, password:'secret1'}
  });
  assert.equal(registration.status, 201);
  const token = registration.data.token;
  assert.ok(token);

  const me = await request(base, '/api/me', {token});
  assert.equal(me.status, 200);
  assert.equal(me.data.user.username, username);

  const run = await request(base, '/api/run/start', {
    method:'POST', token, body:{daily:false}
  });
  assert.equal(run.status, 201);

  const rejected = await request(base, '/api/scores', {
    method:'POST', token,
    body:{runId:run.data.runId, score:5000, classId:'waxguard', region:1, durationMs:1000}
  });
  assert.equal(rejected.status, 400);

  const validRun = await request(base, '/api/run/start', {
    method:'POST', token, body:{daily:false}
  });
  const submitted = await request(base, '/api/scores', {
    method:'POST', token,
    body:{runId:validRun.data.runId, score:1200, classId:'waxguard', region:1, durationMs:1000}
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.user.bestScore, 1200);

  const resubmit = await request(base, '/api/scores', {
    method:'POST', token,
    body:{runId:validRun.data.runId, score:1000, classId:'waxguard', region:1}
  });
  assert.equal(resubmit.status, 400);

  const board = await request(base, '/api/leaderboard');
  assert.equal(board.status, 200);
  assert.equal(board.data.scores[0].username, username);
  assert.equal(board.data.scores[0].score, 1200);

  const dailyA = await request(base, '/api/run/start', {
    method:'POST', token, body:{daily:true}
  });
  const dailyB = await request(base, '/api/run/start', {
    method:'POST', token, body:{daily:true}
  });
  assert.equal(dailyA.data.seed, dailyB.data.seed);
});
