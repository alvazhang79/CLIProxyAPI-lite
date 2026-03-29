// Pages Functions - unified API handler
// Routes /api/* to Workers API, serves static HTML for all other routes

interface Env {
  WORKERS_API_URL: string;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // If it's an API route, proxy to Workers
  if (url.pathname.startsWith('/api') || url.pathname === '/debug') {
    const workersUrl = env.WORKERS_API_URL;
    if (!workersUrl) {
      return new Response(JSON.stringify({ error: 'Workers API URL not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetPath = url.pathname + url.search;
    const targetUrl = workersUrl.replace(/\/$/, '') + targetPath;

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      body = await request.text();
    }

    try {
      const response = await fetch(targetUrl, { method: request.method, headers, body });
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => responseHeaders.set(key, value));
      if (!responseHeaders.has('Content-Type')) {
        responseHeaders.set('Content-Type', 'application/json');
      }
      return new Response(await response.text(), { status: response.status, headers: responseHeaders });
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to reach Workers API' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // For all other routes, return 404 (let static files handle them)
  return new Response('Not Found', { status: 404 });
}
