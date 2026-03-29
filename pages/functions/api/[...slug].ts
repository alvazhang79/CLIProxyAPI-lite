// Pages Functions: Unified admin API proxy to Workers
// Proxies all /api/admin/* requests to the Workers Admin API

interface Env {
  WORKERS_API_URL: string;
  // D1/KV can be added here when Pages needs direct DB access
  // KV: KVNamespace;
  // D1: D1Database;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // Only allow /api/admin/* routes
  if (!url.pathname.startsWith('/api/admin')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const workersUrl = env.WORKERS_API_URL;
  if (!workersUrl) {
    return new Response(JSON.stringify({ error: 'Workers API URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Proxy to Workers
  const targetUrl = workersUrl.replace(/\/$/, '') + url.pathname + url.search;
  const proxiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') ?? '',
      'Accept-Language': request.headers.get('Accept-Language') ?? '',
    },
    body: ['POST', 'PUT', 'PATCH'].includes(request.method)
      ? await request.text()
      : undefined,
  });

  let response: Response;
  try {
    response = await fetch(proxiedRequest);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to reach Workers API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward Set-Cookie headers from Workers
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('Content-Type', 'application/json');

  return new Response(await response.text(), {
    status: response.status,
    headers: responseHeaders,
  });
}
