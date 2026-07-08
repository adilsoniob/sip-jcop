// Proxy all /api/* requests to the Railway backend
const RAILWAY_ORIGIN = 'https://sip-jcop-production.up.railway.app';

export default function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Only proxy /api/* paths, let everything else pass through
  if (!url.pathname.startsWith('/api/')) {
    return fetch(request);
  }

  // Forward the request to Railway keeping the same path and query
  const targetUrl = `${RAILWAY_ORIGIN}${url.pathname}${url.search}`;

  // Fix Host header to match target domain, preserve original client info
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(RAILWAY_ORIGIN).host);
  headers.set('X-Forwarded-Host', request.headers.get('Host') || '');
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP') || '');

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
  });
}
