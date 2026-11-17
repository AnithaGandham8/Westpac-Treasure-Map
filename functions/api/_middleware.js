// CORS for /api/*: lets the GitHub Pages copy of the app call these Cloudflare functions.
// Only the origins below get the headers; browsers on other sites are blocked.
const ALLOWED = ['https://anithagandham8.github.io'];
const isAllowed = (origin) => ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export async function onRequest({ request, next }) {
  const origin = request.headers.get('Origin') || '';
  const cors = isAllowed(origin) ? { 'access-control-allow-origin': origin } : {};

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' },
    });
  }

  const res = await next();
  const headers = new Headers(res.headers);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  headers.append('vary', 'Origin');
  return new Response(res.body, { status: res.status, headers });
}
