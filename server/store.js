// Storage for accounts and leaderboards.
//
// Production (Vercel Functions) uses Redis over the Upstash REST API — what the
// Vercel marketplace integration provisions — so no npm package is needed.
// The local dev server keeps everything in memory and snapshots it to a JSON
// file; tests use the in-memory store directly. On Vercel without Redis we
// refuse to pretend: memory would be wiped between invocations.

import { readFileSync, mkdirSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export class StorageUnavailable extends Error {}

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function redisStore() {
  async function cmd(...args) {
    const res = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(args.map(String))
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new StorageUnavailable(data.error || `redis ${res.status}`);
    return data.result;
  }
  return {
    async get(key) { return cmd('GET', key); },
    async setNX(key, value, ttlSeconds = 0) {
      const args = ['SET', key, value, 'NX'];
      if (ttlSeconds) args.push('EX', ttlSeconds);
      return (await cmd(...args)) === 'OK';
    },
    async incr(key, ttlSeconds) {
      const n = await cmd('INCR', key);
      if (n === 1 && ttlSeconds) await cmd('EXPIRE', key, ttlSeconds);
      return n;
    },
    async zaddGT(key, member, score, ttlSeconds = 0) {
      await cmd('ZADD', key, 'GT', score, member);
      if (ttlSeconds) await cmd('EXPIRE', key, ttlSeconds);
    },
    async zscore(key, member) {
      const v = await cmd('ZSCORE', key, member);
      return v === null ? null : Number(v);
    },
    async zrevrank(key, member) { return cmd('ZREVRANK', key, member); },
    async ztop(key, count) {
      const flat = await cmd('ZRANGE', key, 0, count - 1, 'REV', 'WITHSCORES');
      const out = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i], score: Number(flat[i + 1]) });
      return out;
    }
  };
}

export function memoryStore({ onChange = () => {}, snapshot = null } = {}) {
  const kv = new Map(snapshot?.kv || []);
  const zsets = new Map((snapshot?.zsets || []).map(([key, entries, exp]) => [key, { entries: new Map(entries), exp: exp || 0 }]));

  const live = key => {
    const e = kv.get(key);
    if (e && e.exp && e.exp < Date.now()) { kv.delete(key); return null; }
    return e || null;
  };
  const zset = key => {
    let z = zsets.get(key);
    if (z && z.exp && z.exp < Date.now()) { zsets.delete(key); z = null; }
    if (!z) { z = { entries: new Map(), exp: 0 }; zsets.set(key, z); }
    return z;
  };
  const sorted = key => [...zset(key).entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const ttl = seconds => seconds ? Date.now() + seconds * 1000 : 0;

  return {
    async get(key) { return live(key)?.value ?? null; },
    async setNX(key, value, ttlSeconds = 0) {
      if (live(key)) return false;
      kv.set(key, { value: String(value), exp: ttl(ttlSeconds) });
      onChange();
      return true;
    },
    // Rate-limit counters are deliberately not persisted-worthy, but they
    // live in the same map and simply expire.
    async incr(key, ttlSeconds) {
      const e = live(key);
      const n = e ? Number(e.value) + 1 : 1;
      kv.set(key, { value: String(n), exp: e ? e.exp : ttl(ttlSeconds) });
      return n;
    },
    async zaddGT(key, member, score, ttlSeconds = 0) {
      const z = zset(key);
      if (!z.entries.has(member) || score > z.entries.get(member)) z.entries.set(member, score);
      if (ttlSeconds) z.exp = ttl(ttlSeconds);
      onChange();
    },
    async zscore(key, member) { const z = zset(key).entries; return z.has(member) ? z.get(member) : null; },
    async zrevrank(key, member) { const i = sorted(key).findIndex(([m]) => m === member); return i < 0 ? null : i; },
    async ztop(key, count) { return sorted(key).slice(0, count).map(([member, score]) => ({ member, score })); },
    snapshot() {
      const now = Date.now();
      return {
        kv: [...kv].filter(([k, e]) => !k.startsWith('rl:') && (!e.exp || e.exp > now)),
        zsets: [...zsets].filter(([, z]) => z.entries.size && (!z.exp || z.exp > now)).map(([k, z]) => [k, [...z.entries], z.exp])
      };
    }
  };
}

export function fileStore(file) {
  mkdirSync(dirname(file), { recursive: true });
  let snapshot = null;
  try { snapshot = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }

  let timer = null;
  let writing = Promise.resolve();
  // Writes are serialised; a failed write is logged and reported to whoever
  // awaits flush() (the shutdown handler), never silently turned into success.
  const flush = () => {
    timer = null;
    const data = JSON.stringify(store.snapshot());
    const attempt = writing.then(async () => {
      const tmp = `${file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, file);
    });
    writing = attempt.catch(err => console.error('store: write failed', err));
    return attempt;
  };
  const store = memoryStore({ snapshot, onChange: () => { if (!timer) timer = setTimeout(() => flush().catch(() => {}), 250); } });
  store.flush = () => { clearTimeout(timer); return flush(); };
  return store;
}

let current = null;
export function store() {
  if (current) return current;
  if (REDIS_URL && REDIS_TOKEN) current = redisStore();
  else if (process.env.VERCEL) throw new StorageUnavailable('storage-not-configured');
  else current = memoryStore();
  return current;
}
export function useStore(s) { current = s; }
