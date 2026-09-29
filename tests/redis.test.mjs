// Runs the whole account/score flow against a fake Upstash REST endpoint, so
// the Redis client used in production is exercised command by command.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const kv = new Map(), zsets = new Map(), seen = [], ttl = new Set();
let down = false;
function exec([cmd, ...a]){
  seen.push(cmd);
  const z = k => { if(!zsets.has(k)) zsets.set(k, new Map()); return zsets.get(k); };
  const rev = k => [...z(k)].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  switch(cmd){
    case 'GET': return kv.has(a[0]) ? kv.get(a[0]) : null;
    case 'SET': { const nx = a.includes('NX'); if(nx && kv.has(a[0])) return null; kv.set(a[0], a[1]); if(a.includes('EX')) ttl.add(a[0]); return 'OK'; }
    case 'INCR': { const n = Number(kv.get(a[0]) || 0) + 1; kv.set(a[0], String(n)); return n; }
    case 'EXPIRE': return 1;
    case 'EVAL': { // only the atomic INCR-with-TTL script is expected
      assert.match(a[0], /INCR[\s\S]*TTL[\s\S]*EXPIRE/); assert.equal(a[1], '1');
      const n = exec(['INCR', a[2]]); ttl.add(a[2]); return n; }
    case 'ZADD': { assert.equal(a[1], 'GT'); const s = Number(a[2]), m = a[3], k = z(a[0]); if(!k.has(m) || s > k.get(m)) k.set(m, s); return 1; }
    case 'ZSCORE': { const k = z(a[0]); return k.has(a[1]) ? String(k.get(a[1])) : null; }
    case 'ZREVRANK': { const i = rev(a[0]).findIndex(([m]) => m === a[1]); return i < 0 ? null : i; }
    case 'ZRANGE': { assert.deepEqual(a.slice(3), ['REV', 'WITHSCORES']); return rev(a[0]).slice(Number(a[1]), Number(a[2]) + 1).flatMap(([m, s]) => [m, String(s)]); }
    default: throw new Error('unexpected command ' + cmd);
  }
}
let server, api, sign;
before(async () => {
  server = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    if(down){ req.socket.destroy(); return; }
    if(req.headers.authorization !== 'Bearer test-token'){ res.writeHead(401); return res.end('{"error":"unauthorized"}'); }
    const args = JSON.parse(body);
    assert.ok(args.every(x => typeof x === 'string'), 'arguments must be strings');
    res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({result:exec(args)}));
  }).listen(0);
  await new Promise(r => server.once('listening', r));
  process.env.KV_REST_API_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.VERCEL = '1';
  api = (await import('../server/api.js')).routes;
  sign = (await import('../server/core.js')).sign;
});
after(() => server.close());

const call = async (key, {body, token, query = ''} = {}) => {
  const headers = {'content-type':'application/json', 'x-arcade-client-ip':'192.0.2.1'};
  if(token) headers.authorization = `Bearer ${token}`;
  const [method] = key.split(' ');
  const res = await api[key](new Request(`https://arcade.test/api/x${query}`, {method, headers, body:body ? JSON.stringify(body) : undefined}));
  return {status:res.status, data:await res.json()};
};

test('accounts, runs and leaderboards work over the Upstash REST API', async () => {
  const reg = await call('POST /api/register', {body:{username:'Redis Oie', password:'honk-honk-1'}});
  assert.equal(reg.status, 201);
  assert.equal((await call('POST /api/register', {body:{username:'redis oie', password:'honk-honk-1'}})).status, 409);
  const login = await call('POST /api/login', {body:{username:'REDIS OIE', password:'honk-honk-1'}});
  assert.equal(login.status, 200);
  const {token} = login.data;

  const run = (await call('POST /api/runs', {token, body:{game:'goose-delivery', daily:true}})).data.runToken;
  const payload = JSON.parse(Buffer.from(run.split('.')[0], 'base64url'));
  const aged = sign({...payload, t:Date.now() - 30_000});
  const sub = await call('POST /api/scores', {token, body:{runToken:aged, score:1234}});
  assert.equal(sub.status, 201);
  assert.deepEqual([sub.data.rank, sub.data.dailyRank, sub.data.best], [1, 1, 1234]);
  assert.equal((await call('POST /api/scores', {token, body:{runToken:aged, score:1300}})).status, 409);

  const board = await call('GET /api/scores', {query:'?game=goose-delivery&daily=1'});
  assert.deepEqual(board.data.scores, [{rank:1, username:'Redis Oie', score:1234}]);
  const me = await call('GET /api/me', {token});
  assert.equal(me.data.best['goose-delivery'], 1234);
  for(const c of ['SET','GET','EVAL','ZADD','ZSCORE','ZREVRANK','ZRANGE']) assert.ok(seen.includes(c), `${c} never sent`);
});

test('rate-limit counters always carry an expiry', async () => {
  // A counter left without a TTL (e.g. by an older client) is repaired.
  kv.set('rl:login:192.0.2.1', '1'); ttl.delete('rl:login:192.0.2.1');
  for(let i = 0; i < 3; i++) await call('POST /api/login', {body:{username:'nobody', password:'wrong-password'}});
  const counters = [...kv.keys()].filter(k => k.startsWith('rl:'));
  assert.ok(counters.length, 'no counter created');
  for(const k of counters) assert.ok(ttl.has(k), `${k} has no TTL`);
});

test('a Redis transport failure is a 503 outage, not a 500', async () => {
  down = true;
  try { assert.equal((await call('GET /api/scores', {query:'?game=stack-panic'})).status, 503); }
  finally { down = false; }
});
