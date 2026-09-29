// Adapts the arcade routes (server/api.js) to Vercel Functions. Files in api/
// starting with an underscore are not deployed as endpoints.
import { routes } from '../server/api.js';

export function endpoint(method, path) {
  const handler = routes[`${method} ${path}`];
  if (!handler) throw new Error(`no route for ${method} ${path}`);
  return async request => {
    // Vercel sets x-real-ip / x-forwarded-for itself; never trust a
    // client-supplied x-arcade-client-ip.
    const headers = new Headers(request.headers);
    const ip = headers.get('x-real-ip') || (headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    headers.set('x-arcade-client-ip', ip);
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
    return handler(new Request(request.url, { method, headers, body }));
  };
}
