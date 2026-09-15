import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.HIVEBOUND_SECRET || 'dev-only-secret-change-me';
const ROOT = new URL('.', import.meta.url).pathname;
const PUBLIC = join(ROOT, 'public');
const DATA_DIR = join(ROOT, 'data');
const DB_FILE = join(DATA_DIR, 'db.json');
const GAME_ID = 'hivebound';

await mkdir(DATA_DIR, { recursive: true });

async function loadDb() {
  try { return JSON.parse(await readFile(DB_FILE, 'utf8')); }
  catch { return { users: [], scores: [], runs: [] }; }
}

let db = await loadDb();
let writeQueue = Promise.resolve();
function persist() {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DB_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, DB_FILE);
  });
  return writeQueue;
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 64_000) throw new Error('body-too-large');
  }
  return text ? JSON.parse(text) : {};
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}
function keyUsername(value) { return normalizeUsername(value).toLocaleLowerCase('en-US'); }
function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, user) {
  const candidate = Buffer.from(hashPassword(password, user.salt).hash, 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
function b64url(input) { return Buffer.from(input).toString('base64url'); }
function signToken(user) {
  const payload = b64url(JSON.stringify({ uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }));
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function auth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Date.now()) return null;
    return db.users.find(u => u.id === data.uid) || null;
  } catch { return null; }
}
function cleanUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt, essence: user.essence || 0, bestScore: user.bestScore || 0 };
}
function todaySeed() {
  const d = new Date();
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h >>> 0);
}

async function api(req, res, url) {
  // The client asks this first. On a static deployment nothing answers it and
  // the game switches to local play instead of offering accounts it cannot
  // create.
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'hivebound' });
  }
  if (req.method === 'POST' && url.pathname === '/api/register') {
    const data = await body(req);
    const username = normalizeUsername(data.username);
    const password = String(data.password || '');
    if (username.length < 3 || password.length < 6) return json(res, 400, { error: 'Username ≥ 3 chars and password ≥ 6 chars.' });
    if (db.users.some(u => u.usernameKey === keyUsername(username))) return json(res, 409, { error: 'Username already exists.' });
    const { salt, hash } = hashPassword(password);
    const user = { id: randomBytes(12).toString('hex'), username, usernameKey: keyUsername(username), salt, passwordHash: hash, createdAt: new Date().toISOString(), essence: 0, bestScore: 0 };
    db.users.push(user); await persist();
    return json(res, 201, { token: signToken(user), user: cleanUser(user) });
  }
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const data = await body(req);
    const user = db.users.find(u => u.usernameKey === keyUsername(data.username));
    if (!user || !verifyPassword(data.password, user)) return json(res, 401, { error: 'Invalid credentials.' });
    return json(res, 200, { token: signToken(user), user: cleanUser(user) });
  }
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const user = auth(req); if (!user) return json(res, 401, { error: 'Unauthorized' });
    return json(res, 200, { user: cleanUser(user) });
  }
  if (req.method === 'POST' && url.pathname === '/api/run/start') {
    const user = auth(req);
    const data = await body(req);
    const daily = Boolean(data.daily);
    const run = {
      id: randomBytes(12).toString('hex'), userId: user?.id || null, gameId: GAME_ID,
      seed: daily ? todaySeed() : randomBytes(4).readUInt32LE(0), daily,
      startedAt: Date.now(), consumed: false
    };
    db.runs.push(run);
    if (db.runs.length > 5000) db.runs = db.runs.slice(-3000);
    await persist();
    return json(res, 201, { runId: run.id, seed: run.seed, daily });
  }
  if (req.method === 'POST' && url.pathname === '/api/scores') {
    const user = auth(req); if (!user) return json(res, 401, { error: 'Login required to submit a score.' });
    const data = await body(req);
    const run = db.runs.find(r => r.id === data.runId && !r.consumed);
    if (!run || (run.userId && run.userId !== user.id)) return json(res, 400, { error: 'Invalid run.' });
    const elapsed = Date.now() - run.startedAt;
    const score = Math.floor(Number(data.score));
    if (!Number.isFinite(score) || score < 0 || score > 100_000_000) return json(res, 400, { error: 'Invalid score.' });
    if (elapsed < 10_000 && score > 2000) return json(res, 400, { error: 'Run validation failed.' });
    run.consumed = true;
    const record = {
      id: randomBytes(10).toString('hex'), gameId: GAME_ID, userId: user.id, username: user.username,
      score, classId: String(data.classId || 'unknown').slice(0, 32), region: Math.max(1, Math.floor(Number(data.region || 1))),
      durationMs: Math.max(0, Math.floor(Number(data.durationMs || elapsed))), daily: Boolean(run.daily), seed: run.seed,
      createdAt: new Date().toISOString()
    };
    db.scores.push(record);
    if (score > (user.bestScore || 0)) user.bestScore = score;
    user.essence = (user.essence || 0) + Math.max(1, Math.floor(score / 5000));
    await persist();
    return json(res, 201, { score: record, user: cleanUser(user) });
  }
  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    const daily = url.searchParams.get('daily') === '1';
    const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit') || 20)));
    const today = new Date().toISOString().slice(0, 10);
    const source = db.scores.filter(s => !daily || (s.daily && s.createdAt.slice(0, 10) === today));
    const bestByUser = new Map();
    for (const s of source) {
      const prev = bestByUser.get(s.userId);
      if (!prev || s.score > prev.score) bestByUser.set(s.userId, s);
    }
    const scores = [...bestByUser.values()].sort((a,b) => b.score - a.score).slice(0, limit)
      .map((s, i) => ({ rank: i+1, username: s.username, score: s.score, classId: s.classId, region: s.region, durationMs: s.durationMs, createdAt: s.createdAt }));
    return json(res, 200, { scores, daily });
  }
  return json(res, 404, { error: 'Not found' });
}

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
function staticFile(req, res, url) {
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  const safe = normalize(path).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(PUBLIC, safe);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  const stream = createReadStream(file);
  stream.on('error', () => {
    if (path !== '/index.html') {
      const fallback = createReadStream(join(PUBLIC, 'index.html'));
      fallback.on('error', () => { res.writeHead(404); res.end('Not found'); });
      res.writeHead(200, { 'content-type':'text/html; charset=utf-8' }); fallback.pipe(res);
    } else { res.writeHead(404); res.end('Not found'); }
  });
  stream.on('open', () => { res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control':'no-cache' }); stream.pipe(res); });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else staticFile(req, res, url);
  } catch (e) {
    console.error(e); json(res, 500, { error: 'Internal server error' });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Hivebound listening on http://0.0.0.0:${PORT}`));
