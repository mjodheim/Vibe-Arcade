// Local development server. Production runs on Vercel (static files routed by
// vercel.json + the functions in api/); this mirrors that setup in a single
// dependency-free Node process: the landing page, every cabinet under
// /<game>/ and the account/leaderboard API, with a JSON-file store.
//
//   PORT            listen port (default 8080)
//   ARCADE_SECRET   signs sessions and runs — required when NODE_ENV=production
//   DATA_DIR        where the JSON store lives (default ./data)

import http from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { routes } from './api.js';
import { fileStore, useStore } from './store.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');

if (process.env.NODE_ENV === 'production' && (process.env.ARCADE_SECRET || '').length < 16) {
  console.error('ARCADE_SECRET (16+ characters) is required in production.');
  process.exit(1);
}

const db = fileStore(join(DATA_DIR, 'arcade.json'));
useStore(db);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'
};

// Only these top-level files/folders of the repository are public.
const ROOT_FILES = new Set(['index.html', 'arcade.css', 'arcade-stack.css', 'arcade-v2.css', 'arcade.js']);
const ROOT_DIRS = new Set(['assets', 'shared']);
const RETIRED = new Set(['hivebound']);

async function isFile(path) { return (await stat(path).catch(() => null))?.isFile() ?? false; }
async function isDir(path) { return (await stat(path).catch(() => null))?.isDirectory() ?? false; }

function inside(base, rel) {
  const full = normalize(join(base, rel));
  return full === base || full.startsWith(base.endsWith(sep) ? base : base + sep) ? full : null;
}

// Maps a URL path to a file on disk, a redirect, or nothing.
async function resolvePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return { file: join(ROOT, 'index.html') };
  const [head, ...rest] = parts;
  if (RETIRED.has(head)) return { redirect: '/' };
  if (parts.length === 1 && ROOT_FILES.has(head)) return { file: join(ROOT, head) };
  if (ROOT_DIRS.has(head)) {
    const file = inside(join(ROOT, head), rest.join('/'));
    return file && await isFile(file) ? { file } : null;
  }
  const game = join(ROOT, 'games', head, 'public');
  if (/^[a-z0-9-]+$/.test(head) && await isDir(game)) {
    if (!rest.length && !pathname.endsWith('/')) return { redirect: `/${head}/` };
    const file = inside(game, rest.length ? rest.join('/') : 'index.html');
    if (file && await isFile(file)) return { file };
    if (file && await isFile(join(file, 'index.html'))) return { file: join(file, 'index.html') };
  }
  return null;
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

async function api(req, res, url) {
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end('{"error":"Not found"}');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_000) { res.writeHead(413); return res.end(); }
    chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  headers.set('x-arcade-client-ip', clientIp(req));
  const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  const target = await resolvePath(pathname);
  if (target?.redirect) { res.writeHead(302, { location: target.redirect }); return res.end(); }
  if (!target) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>404</title><body style="background:#05070d;color:#dce5f7;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>GAME OVER · 404</h1><p><a style="color:#43efff" href="/">← Retour à l’arcade</a></p></div>');
  }
  const body = await readFile(target.file);
  const type = MIME[extname(target.file)] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=300',
    'x-content-type-options': 'nosniff'
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://arcade.local');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(PORT, () => console.log(`Vibe Arcade listening on http://localhost:${PORT}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    await db.flush();
    process.exit(0);
  });
}
