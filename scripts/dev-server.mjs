// Local stand-in for Vercel: serves the static site with the rewrites from
// vercel.json and runs the functions in api/ against the in-memory store.
//   node scripts/dev-server.mjs  →  http://localhost:3000
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 3000);
const config = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };

function rewrite(pathname) {
  for (const r of config.redirects || []) {
    if (r.source === pathname) return { redirect: r.destination };
    if (r.source.endsWith('/:path*') && pathname.startsWith(r.source.slice(0, -':path*'.length))) return { redirect: r.destination };
  }
  for (const r of config.rewrites || []) {
    if (r.source === pathname) return { path: r.destination };
    if (r.source.endsWith('/:path*')) {
      const base = r.source.slice(0, -'/:path*'.length);
      if (pathname.startsWith(base + '/')) return { path: r.destination.replace(':path*', pathname.slice(base.length + 1)) };
    }
  }
  return { path: pathname };
}

async function api(req, res, url) {
  const name = url.pathname.slice('/api/'.length).replace(/[^a-z-]/g, '');
  let mod;
  try { mod = await import(join(ROOT, 'api', `${name}.js`)); } catch { res.writeHead(404); return res.end('{"error":"Not found"}'); }
  const handler = mod[req.method];
  if (!handler) { res.writeHead(405); return res.end('{"error":"Method not allowed"}'); }
  const chunks = []; for await (const c of req) chunks.push(c);
  const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const target = rewrite(url.pathname);
    if (target.redirect) { res.writeHead(307, { location: target.redirect }); return res.end(); }
    let file = join(ROOT, normalize(decodeURIComponent(target.path)));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(PORT, () => console.log(`Vibe Arcade dev server on http://localhost:${PORT}`));
