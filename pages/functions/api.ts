// Pages Functions: Unified API proxy to Workers
// Routes ALL /api/* requests to the Workers API
// Workers handles internal routing (admin vs. proxy)

interface Env {
  WORKERS_API_URL: string;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const workersUrl = env.WORKERS_API_URL;
  if (!workersUrl) {
    return new Response(JSON.stringify({ error: 'Workers API URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward to Workers ( Workers handles all routing internally)
  const targetPath = url.pathname + url.search;
  const targetUrl = workersUrl.replace(/\/$/, '') + targetPath;

  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
    'Authorization': request.headers.get('Authorization') ?? '',
  };

  // Forward forwarded headers
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;

  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    body = await request.text();
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to reach Workers API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const responseHeaders = new Headers(response.headers);
  if (!responseHeaders.has('Content-Type')) {
    responseHeaders.set('Content-Type', 'application/json');
  }

  return new Response(await response.text(), {
    status: response.status,
    headers: responseHeaders,
  });
}
