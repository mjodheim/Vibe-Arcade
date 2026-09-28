import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { store, StorageUnavailable } from './store.js';

// Games that can submit scores, with a generous plausibility ceiling:
// a run cannot have scored faster than `perSecond` on average, plus a burst.
export const GAMES = {
  'stack-panic': { perSecond: 900, burst: 4000, max: 50_000_000 },
  'forbidden-fruit': { perSecond: 250, burst: 3000, max: 10_000_000 },
  'pigeon-control': { perSecond: 400, burst: 2000, max: 10_000_000 },
  'goose-delivery': { perSecond: 250, burst: 2000, max: 10_000_000 }
};

const TOKEN_DAYS = 30;
const RUN_MAX_MS = 6 * 60 * 60 * 1000;

function secret() {
  const s = process.env.ARCADE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') throw new StorageUnavailable('secret-not-configured');
  return 'dev-only-arcade-secret-change-me';
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

// Every handler goes through this so storage/config failures become a clear
// 503 the client can show, instead of an opaque crash.
export function route(fn) {
  return async request => {
    try { return await fn(request); }
    catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      if (e instanceof StorageUnavailable) return json(503, { error: 'Le serveur de scores est indisponible.', code: e.message });
      console.error(e);
      return json(500, { error: 'Erreur interne.' });
    }
  };
}

export async function readJson(request) {
  const text = await request.text();
  if (text.length > 16_000) throw new HttpError(413, 'Requête trop volumineuse.');
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'JSON invalide.'); }
}

// The HTTP server resolves the client address (honouring X-Forwarded-For only
// when TRUST_PROXY is set) and hands it over in this header, overwriting
// anything the client sent.
export function clientIp(request) {
  return request.headers.get('x-arcade-client-ip') || 'local';
}

export async function limit(bucket, max, windowSeconds) {
  const n = await store().incr(`rl:${bucket}`, windowSeconds);
  if (n > max) throw new HttpError(429, 'Trop de tentatives. Réessaie dans quelques minutes.');
}

// ------------------------------------------------------------------ accounts

export function normalizeUsername(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}
export function usernameKey(value) { return normalizeUsername(value).toLowerCase(); }
const USERNAME_RE = /^[\p{L}\p{N}_\-. ]{3,20}$/u;

export function validateCredentials(username, password) {
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Pseudo : 3 à 20 caractères (lettres, chiffres, espace, _ - .).');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw new HttpError(400, 'Mot de passe : 8 caractères minimum.');
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
export function verifyPassword(password, user) {
  const candidate = Buffer.from(hashPassword(String(password), user.salt).hash, 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return data.exp && data.exp < Date.now() ? null : data;
  } catch { return null; }
}

export function sessionToken(user) {
  return sign({ typ: 'session', uid: user.id, key: usernameKey(user.username), name: user.username, exp: Date.now() + TOKEN_DAYS * 864e5 });
}

export async function loadUser(key) {
  const raw = await store().get(`user:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function requireUser(request) {
  const header = request.headers.get('authorization') || '';
  const data = verify(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!data || data.typ !== 'session') throw new HttpError(401, 'Connecte-toi pour continuer.');
  const user = await loadUser(data.key);
  if (!user || user.id !== data.uid) throw new HttpError(401, 'Session expirée.');
  return user;
}

export function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

// ------------------------------------------------------------------ runs & scores

export function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

export function runToken(user, game, daily) {
  return sign({ typ: 'run', rid: randomBytes(12).toString('hex'), uid: user.id, key: usernameKey(user.username), game, daily: !!daily, day: dayKey(), t: Date.now(), exp: Date.now() + RUN_MAX_MS });
}

export function boardKey(game, daily, day = dayKey()) {
  return daily ? `lb:${game}:daily:${day}` : `lb:${game}:all`;
}
