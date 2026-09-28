// Storage for accounts and leaderboards.
//
// Production uses Redis over the Upstash REST API (what the Vercel
// marketplace integration provisions), so the functions need no npm package.
// Locally and in tests an in-memory store with the same interface is used.
// On Vercel without Redis configured we refuse to pretend: memory would be
// wiped between invocations and accounts would silently disappear.

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

export class StorageUnavailable extends Error {}

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

export function memoryStore() {
  const kv = new Map();
  const zsets = new Map();
  const expired = key => {
    const e = kv.get(key);
    if (e && e.exp && e.exp < Date.now()) { kv.delete(key); return true; }
    return !e;
  };
  const zset = key => { if (!zsets.has(key)) zsets.set(key, new Map()); return zsets.get(key); };
  const sorted = key => [...zset(key)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    async get(key) { return expired(key) ? null : kv.get(key).value; },
    async setNX(key, value, ttlSeconds = 0) {
      if (!expired(key)) return false;
      kv.set(key, { value: String(value), exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
      return true;
    },
    async incr(key, ttlSeconds) {
      const n = expired(key) ? 1 : Number(kv.get(key).value) + 1;
      kv.set(key, { value: String(n), exp: n === 1 && ttlSeconds ? Date.now() + ttlSeconds * 1000 : kv.get(key)?.exp || 0 });
      return n;
    },
    async zaddGT(key, member, score) {
      const z = zset(key);
      if (!z.has(member) || score > z.get(member)) z.set(member, score);
    },
    async zscore(key, member) { const z = zset(key); return z.has(member) ? z.get(member) : null; },
    async zrevrank(key, member) { const i = sorted(key).findIndex(([m]) => m === member); return i < 0 ? null : i; },
    async ztop(key, count) { return sorted(key).slice(0, count).map(([member, score]) => ({ member, score })); }
  };
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
