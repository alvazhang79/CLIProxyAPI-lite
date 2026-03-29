// Cloudflare Pages Functions - catch-all proxy to Workers API
// [[catchall]] matches ANY path depth

interface Env {
  WORKERS_API_URL: string;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname; // e.g. /api/admin/login

  const workersUrl = env.WORKERS_API_URL;
  if (!workersUrl) {
    return new Response(JSON.stringify({ error: 'Workers API URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = workersUrl.replace(/\/$/, '') + path + url.search;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });
    if (!responseHeaders.has('Content-Type')) {
      responseHeaders.set('Content-Type', 'application/json');
    }

    return new Response(await response.text(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to reach Workers API', path }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
