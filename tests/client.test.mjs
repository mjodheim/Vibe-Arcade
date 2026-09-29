// The browser account client, run in a sandbox with a scripted fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function client(responses){
  const calls = [];
  const storage = new Map();
  const sandbox = {
    localStorage:{ getItem:k => storage.get(k) ?? null, setItem:(k, v) => storage.set(k, String(v)), removeItem:k => storage.delete(k) },
    setTimeout:fn => { fn(); return 0; },
    AbortSignal, console,
    fetch: async (url, opts) => {
      calls.push({ url, body:opts.body, signal:!!opts.signal });
      const next = responses.shift();
      if (next === 'network') throw new TypeError('fetch failed');
      return new Response(JSON.stringify(next.body), { status:next.status });
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync('shared/account.js', 'utf8'), sandbox);
  return { api:sandbox.ArcadeAccount, calls };
}

test('score submission retries the same run through transient failures', async () => {
  const { api, calls } = client(['network', { status:503, body:{ error:'down' } }, { status:201, body:{ rank:1 } }]);
  const res = await api.submitScore('run-token', 1234);
  assert.equal(res.rank, 1);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(c => c.body === JSON.stringify({ runToken:'run-token', score:1234 })), 'retry changed the submission');
  assert.ok(calls.every(c => c.signal), 'requests are not bounded by a timeout');
});

test('a definitive refusal is not retried', async () => {
  const { api, calls } = client([{ status:409, body:{ error:'déjà enregistré' } }]);
  await assert.rejects(api.submitScore('run-token', 1), /déjà enregistré/);
  assert.equal(calls.length, 1);
});

test('the run day comes back with the run token', async () => {
  const { api } = client([{ status:201, body:{ runToken:'t', day:'2026-09-29' } }]);
  assert.deepEqual({ ...(await api.startRun('stack-panic', true)) }, { token:'t', day:'2026-09-29' });
});

test('only the refresh right after a daily submission pins the board to that run day', async () => {
  const boards = [];
  const Account = {
    loggedIn:true, user:{ username:'ana' },
    onChange(){}, refresh:async () => {}, renderChip(){},
    leaderboard:async (game, daily, limit, day) => { boards.push({ daily, day }); return []; },
    startRun:async () => ({ token:'t', day:'2026-09-28' }),
    submitScore:async () => ({ rank:1, dailyRank:1, day:'2026-09-28' })
  };
  const el = () => ({ classList:{ toggle(){} }, replaceChildren(){}, appendChild(){}, setAttribute(){}, addEventListener(){} });
  const sandbox = { ArcadeAccount:Account, setTimeout, document:{ createElement:el } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync('shared/cabinet.js', 'utf8'), sandbox);
  const tab = { ...el(), dataset:{ board:'daily' }, addEventListener(type, fn){ this.click = fn; } };
  const cab = sandbox.ArcadeCabinet.create({ game:'forbidden-fruit', start(){}, board:el(), tabs:[tab] });
  tab.click();
  await cab.play(true);
  await cab.finish(10);
  tab.click();
  await new Promise(resolve => setImmediate(resolve));
  const daily = boards.filter(b => b.daily).map(b => b.day);
  assert.deepEqual(daily, ['', '2026-09-28', ''], 'a later daily refresh kept showing the old day');
});
