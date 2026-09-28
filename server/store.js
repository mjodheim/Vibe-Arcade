// Storage for accounts and leaderboards.
//
// The arcade runs as a single Node process on the VPS, so the store is kept
// in memory and snapshotted to a JSON file (atomic write, debounced). Tests
// use the same store without a file.

import { readFileSync, mkdirSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export class StorageUnavailable extends Error {}

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
  const flush = () => {
    timer = null;
    const data = JSON.stringify(store.snapshot());
    writing = writing.then(async () => {
      const tmp = `${file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, file);
    }).catch(err => console.error('store: write failed', err));
    return writing;
  };
  const store = memoryStore({ snapshot, onChange: () => { if (!timer) timer = setTimeout(flush, 250); } });
  store.flush = () => { clearTimeout(timer); return flush(); };
  return store;
}

let current = null;
export function store() {
  if (!current) current = memoryStore();
  return current;
}
export function useStore(s) { current = s; }
