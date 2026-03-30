// Workers Admin API — unified handler for all /api/admin/* routes
import type { Context } from 'hono';
import { APIError } from '../middleware/error';
import { detectLang } from '../i18n';
import {
  listAPIKeys, createAPIKey, deleteAPIKey, updateAPIKey,
  listCustomProviders, createCustomProvider, deleteCustomProvider, updateCustomProvider,
  listAllModels, findCustomProviderById,
  createProviderAPIKey, listProviderAPIKeys, deleteProviderAPIKey,
  getStats,
} from '../db/d1';
import { deleteAdminSession } from '../db/kv';
import { encrypt, decrypt, type Encrypted } from '../lib/crypto';
import type { CachedAPIKey } from '../types/provider';

// ---- Auth helpers ----

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authenticateAdmin(c: Context): Promise<void> {
  // Support both Cookie and Authorization: Bearer header
  const cookie = c.req.header('Cookie') ?? '';
  const match = cookie.match(/session=([^;]+)/);
  let sessionToken = match?.[1];

  // Fallback: check Authorization: Bearer <token>
  if (!sessionToken) {
    const auth = c.req.header('Authorization') ?? '';
    const bearer = auth.match(/^Bearer\s+(.+)$/);
    sessionToken = bearer?.[1];
  }

  const lang = detectLang(c.req.header('accept-language'));
  if (!sessionToken) throw new APIError(401, 'unauthorized', 'No session token', lang);

  const kv = c.get('KV');
  const session = await kv.get('session:' + sessionToken.slice(0, 64), 'json') as {
    expires_at: number;
  } | null;

  if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
    throw new APIError(401, 'unauthorized', 'Session expired', lang);
  }
}

// ---- Encryption helpers for API secrets ----

async function encryptSecret(c: Context, plaintext: string): Promise<string> {
  const key = c.env.ENCRYPTION_KEY;
  if (!key) return plaintext; // Fallback: no encryption in dev
  const enc = await encrypt(plaintext, key);
  return JSON.stringify(enc); // Store as JSON string in D1
}

async function decryptSecret(c: Context, ciphertext: string): Promise<string> {
  const key = c.env.ENCRYPTION_KEY;
  if (!key) return ciphertext;
  const enc = JSON.parse(ciphertext) as Encrypted;
  return decrypt(enc, key);
}

// ---- POST /api/admin/login ----
export async function handleAdminLogin(c: Context): Promise<Response> {
  const body = await c.req.json().catch(() => ({})) as { token?: string };
  const adminToken = c.env.ADMIN_TOKEN as string;

  if (!adminToken) {
    return c.json({ ok: false, error: 'Server error' }, 500);
  }

  const submittedToken = typeof body?.token === 'string' ? body.token : '';
  if (submittedToken !== adminToken) {
    return c.json({ ok: false, error: '令牌无效' }, 401);
  }

  const sessionToken = crypto.randomUUID();
  const kv = c.get('KV');
  const session = {
    id: crypto.randomUUID(),
    token_hash: await hashToken(sessionToken),
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    created_at: Math.floor(Date.now() / 1000),
  };

  await kv.put('session:' + sessionToken.slice(0, 64), JSON.stringify(session), {
    expirationTtl: 86400,
  });

  return new Response(JSON.stringify({ ok: true, token: sessionToken }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${sessionToken}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`,
    },
  });
}

// ---- POST /api/admin/logout ----
export async function handleAdminLogout(c: Context): Promise<Response> {
  const cookie = c.req.header('Cookie') ?? '';
  const match = cookie.match(/session=([^;]+)/);
  let sessionToken = match?.[1];
  if (!sessionToken) {
    const auth = c.req.header('Authorization') ?? '';
    const bearer = auth.match(/^Bearer\s+(.+)$/);
    sessionToken = bearer?.[1];
  }
  if (sessionToken) {
    const kv = c.get('KV');
    await deleteAdminSession(kv, sessionToken);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0',
    },
  });
}

// ---- GET /api/admin/keys ----
export async function handleListKeys(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const keys = await listAPIKeys(d1);
  return c.json({ keys });
}

// ---- POST /api/admin/keys ----
export async function handleCreateKey(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const body = await c.req.json().catch(() => null) as {
    name?: string; provider?: string; model?: string;
    allowed_models?: string[];
    api_secret?: string; embeddings_model?: string; rate_limit?: number;
  } | null;

  if (!body?.name || !body?.provider || !body?.model) {
    throw new APIError(400, 'invalid_request', 'Missing required fields', detectLang(c.req.header('accept-language')));
  }

  const rawKey = 'sk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');
  const keyHash = await hashToken(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  // Encrypt the upstream API secret (only if provided, not for regenerate mode)
  const encryptedSecret = body.api_secret && body.api_secret !== 'regenerate'
    ? await encryptSecret(c, body.api_secret)
    : '';

  const id = crypto.randomUUID();
  const allowedModels: string[] = Array.isArray(body.allowed_models) && body.allowed_models.length > 0
    ? body.allowed_models
    : []; // empty = allow all models (backward compat)

  await createAPIKey(d1, {
    id,
    api_key: keyHash,
    key_prefix: keyPrefix,
    name: body.name,
    provider: body.provider,
    model: body.model,
    allowed_models: allowedModels,
    api_secret: encryptedSecret,
    embeddings_provider: body.embeddings_model ? body.provider : undefined,
    embeddings_model: body.embeddings_model,
    excluded_models: [],
    rate_limit: body.rate_limit ?? 60,
    enabled: true,
  });

  return c.json({
    id, key_prefix: keyPrefix, name: body.name,
    provider: body.provider, model: body.model,
    allowed_models: allowedModels,
    key_value: rawKey, // returned ONCE only
    embeddings_model: body.embeddings_model,
    rate_limit: body.rate_limit ?? 60,
    enabled: true,
  });
}

// ---- DELETE /api/admin/keys/:id ----
export async function handleDeleteKey(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  await deleteAPIKey(d1, id);
  return c.json({ ok: true });
}

// ---- PATCH /api/admin/keys/:id ----
export async function handlePatchKey(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const d1 = c.get('D1');

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.model !== undefined) updates.model = body.model;
  if (body.provider !== undefined) updates.provider = body.provider;
  if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
  if (body.rate_limit !== undefined) updates.rate_limit = Number(body.rate_limit);
  if (body.allowed_models !== undefined) {
    updates.allowed_models = JSON.stringify(body.allowed_models);
  }

  await updateAPIKey(d1, id, updates as Parameters<typeof updateAPIKey>[2]);
  return c.json({ ok: true });
}

// ---- GET /api/admin/providers ----
export async function handleListProviders(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const providers = await listCustomProviders(d1);
  return c.json({ providers });
}

// ---- POST /api/admin/providers ----
export async function handleCreateProvider(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.name || !body?.base_url) {
    throw new APIError(400, 'invalid_request', 'name and base_url required', detectLang(c.req.header('accept-language')));
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Encrypt API key if provided
  let encryptedCredentials = '';
  if (body.api_key && (body.api_key as string).trim() !== '') {
    encryptedCredentials = await encryptSecret(c, body.api_key as string);
  }

  await createCustomProvider(d1, {
    id,
    name: body.name as string,
    display_name: (body.display_name as string) ?? (body.name as string),
    base_url: body.base_url as string,
    auth_type: (body.auth_type as 'bearer' | 'api_key' | 'custom') ?? 'bearer',
    auth_header: (body.auth_header as string) ?? 'Authorization',
    headers: (typeof body.headers === 'object' && body.headers !== null)
      ? (body.headers as Record<string, string>) : {},
    proxy_url: (body.proxy_url as string) ?? '',
    encrypted_credentials: encryptedCredentials,
    enabled: true,
    created_at: now,
    updated_at: now,
  });

  return c.json({ id, ...body });
}

// ---- DELETE /api/admin/providers/:id ----
export async function handleDeleteProvider(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  await deleteCustomProvider(d1, id);
  return c.json({ ok: true });
}

// ---- PATCH /api/admin/providers/:id ----
export async function handlePatchProvider(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) throw new APIError(400, 'invalid_request', 'Body required', detectLang(c.req.header('accept-language')));

  const provider = await findCustomProviderById(d1, id);
  if (!provider) throw new APIError(404, 'not_found', 'Provider not found', detectLang(c.req.header('accept-language')));

  const updates: Parameters<typeof updateCustomProvider>[2] = {};
  if (body.display_name !== undefined) updates.display_name = body.display_name as string;
  if (body.base_url !== undefined) updates.base_url = body.base_url as string;
  if (body.auth_type !== undefined) updates.auth_type = body.auth_type as 'bearer' | 'api_key' | 'custom';
  if (body.auth_header !== undefined) updates.auth_header = body.auth_header as string;
  if (body.headers !== undefined) updates.headers = body.headers as Record<string, string>;
  if (body.proxy_url !== undefined) updates.proxy_url = body.proxy_url as string;
  if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

  // Encrypt credentials if provided
  if (body.api_key !== undefined && body.api_key !== '') {
    updates.encrypted_credentials = await encryptSecret(c, body.api_key as string);
  }

  if (Object.keys(updates).length > 0) {
    await updateCustomProvider(d1, id, updates);
  }

  const updated = await findCustomProviderById(d1, id);
  return c.json({ ok: true, provider: updated });
}

// ---- POST /api/admin/providers/:id/models ----
export async function handleFetchProviderModels(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  let body: Record<string, unknown> | null = null;
  try {
    // Use raw Request to parse body (more reliable in CF Workers)
    body = await c.req.raw.json() as Record<string, unknown> | null;
  } catch {
    body = null;
  }

  const provider = await findCustomProviderById(d1, id);
  if (!provider) throw new APIError(404, 'not_found', 'Provider not found', detectLang(c.req.header('accept-language')));

  // Use provided API key, or decrypt stored credentials
  const apiKey = (body?.api_key as string) || provider.encrypted_credentials;

  if (!apiKey) {
    throw new APIError(400, 'invalid_request', 'Provider API key required (provide api_key in body or set it in provider settings)', detectLang(c.req.header('accept-language')));
  }

  // Decrypt if it's an encrypted string (starts with {)
  let secret = apiKey;
  if (apiKey.startsWith('{')) {
    try {
      secret = await decryptSecret(c, apiKey);
    } catch {
      // Not encrypted, use as-is
    }
  }

  const baseUrl = (provider.base_url || '').replace(/\/$/, '');
  const endpoint = `${baseUrl}/models`;

  let authValue = secret;
  if (provider.auth_type === 'bearer') {
    authValue = `Bearer ${secret}`;
  } else if (provider.auth_type === 'api_key') {
    authValue = secret;
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        [provider.auth_header || 'Authorization']: authValue,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new APIError(502, 'upstream_error', `Provider returned ${response.status}: ${text}`, detectLang(c.req.header('accept-language')));
    }

    const data = await response.json() as Record<string, unknown>;
    let models: Array<{ id: string; display_name: string; created?: number }> = [];

    // OpenAI format: { data: [{ id: "gpt-4", ... }] }
    if (data.data && Array.isArray(data.data)) {
      models = (data.data as Array<Record<string, unknown>>).map(m => ({
        id: String(m.id ?? ''),
        display_name: String(m.id ?? ''),
        created: m.created as number | undefined,
      }));
    }
    // Generic array format
    else if (Array.isArray(data)) {
      models = (data as Array<Record<string, unknown>>).map(m => ({
        id: String(typeof m === 'string' ? m : (m.id ?? m.name ?? '')),
        display_name: String(typeof m === 'string' ? m : (m.display_name ?? m.name ?? m.id ?? '')),
        created: m.created as number | undefined,
      }));
    }

    return c.json({ models, provider: provider.name });
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(502, 'upstream_error', `Failed to fetch models: ${(err as Error).message}`, detectLang(c.req.header('accept-language')));
  }
}

// ---- GET /api/admin/providers/:id/keys ----
export async function handleListProviderKeys(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  const keys = await listProviderAPIKeys(d1, id);
  return c.json({ keys });
}

// ---- POST /api/admin/providers/:id/keys ----
export async function handleCreateProviderAPIKey(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.name || !body?.api_key) {
    throw new APIError(400, 'invalid_request', 'name and api_key required', detectLang(c.req.header('accept-language')));
  }

  const provider = await findCustomProviderById(d1, id);
  if (!provider) throw new APIError(404, 'not_found', 'Provider not found', detectLang(c.req.header('accept-language')));

  const keyId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const encryptedKey = await encryptSecret(c, body.api_key as string);

  await createProviderAPIKey(d1, {
    id: keyId,
    provider_id: id,
    name: body.name as string,
    api_key: encryptedKey,
    priority: (body.priority as number) ?? 100,
    enabled: true,
    created_at: now,
    updated_at: now,
  });

  return c.json({ id: keyId, name: body.name, priority: (body.priority as number) ?? 100 });
}

// ---- DELETE /api/admin/providers/:id/keys/:keyId ----
export async function handleDeleteProviderAPIKey(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const { id, keyId } = c.req.param() as { id: string; keyId: string };
  const d1 = c.get('D1');
  await deleteProviderAPIKey(d1, keyId);
  return c.json({ ok: true });
}

// ---- GET /api/admin/models ----
export async function handleListModels(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const models = await listAllModels(d1);
  return c.json({ models });
}

// ---- POST /api/admin/models ----
export async function handleCreateModel(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.provider_id || !body?.model || !body?.alias) {
    throw new APIError(400, 'invalid_request', 'provider_id, model, alias required', detectLang(c.req.header('accept-language')));
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await d1.prepare(
    'INSERT INTO custom_models (id, provider_id, model, alias, display_name, api_format, ' +
    'supports_streaming, supports_functions, context_window, enabled, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
  ).bind(
    id, body.provider_id, body.model, body.alias,
    (body.display_name as string) ?? (body.alias as string),
    (body.api_format as string) ?? 'openai',
    body.supports_streaming ? 1 : 0,
    body.supports_functions ? 1 : 0,
    body.context_window ?? null,
    now, now
  ).run();

  return c.json({ id, ...body });
}

// ---- DELETE /api/admin/models/:id ----
export async function handleDeleteModel(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  await d1.prepare('DELETE FROM custom_models WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
}

// ---- GET /api/admin/embeddings ----
export async function handleListEmbeddings(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const url = new URL(c.req.url);
  const apiKeyId = url.searchParams.get('api_key_id');
  const q = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') ?? '50');

  let query = 'SELECT id, api_key_id, text, model, metadata, created_at FROM embeddings_index WHERE 1=1';
  const bindings: unknown[] = [];
  if (apiKeyId) { query += ' AND api_key_id = ?'; bindings.push(apiKeyId); }
  if (q) { query += ' AND text LIKE ?'; bindings.push('%' + q + '%'); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const { results } = await d1.prepare(query).bind(...bindings).all();
  return c.json({ results: results ?? [] });
}

// ---- DELETE /api/admin/embeddings/:id ----
export async function handleDeleteEmbedding(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const id = c.req.param('id') as string;
  const d1 = c.get('D1');
  await d1.prepare('DELETE FROM embeddings_index WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
}

// ---- GET /api/admin/logs ----
export async function handleListLogs(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const url = new URL(c.req.url);
  const provider = url.searchParams.get('provider');
  const endpoint = url.searchParams.get('endpoint');
  const statusFilter = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') ?? '0');
  const limit = parseInt(url.searchParams.get('limit') ?? '50');
  const offset = page * limit;

  let query = 'SELECT rl.*, ak.name as key_name FROM request_logs rl LEFT JOIN api_keys ak ON rl.api_key_id = ak.id WHERE 1=1';
  const bindings: unknown[] = [];

  if (provider) { query += ' AND rl.provider = ?'; bindings.push(provider); }
  if (endpoint) { query += ' AND rl.endpoint LIKE ?'; bindings.push('%' + endpoint + '%'); }
  if (statusFilter === 'success') { query += ' AND rl.status_code < 400'; }
  else if (statusFilter === 'error') { query += ' AND rl.status_code >= 400'; }

  query += ' ORDER BY rl.created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const { results } = await d1.prepare(query).bind(...bindings).all();

  let countQuery = 'SELECT COUNT(*) as cnt FROM request_logs WHERE 1=1';
  const countBindings: unknown[] = [];
  if (provider) { countQuery += ' AND provider = ?'; countBindings.push(provider); }
  if (endpoint) { countQuery += ' AND endpoint LIKE ?'; countBindings.push('%' + endpoint + '%'); }
  if (statusFilter === 'success') { countQuery += ' AND status_code < 400'; }
  else if (statusFilter === 'error') { countQuery += ' AND status_code >= 400'; }
  const totalRow = await d1.prepare(countQuery).bind(...countBindings).first();

  return c.json({
    logs: results ?? [],
    total: (totalRow?.cnt as number) ?? 0,
    has_more: (totalRow?.cnt as number ?? 0) > offset + limit,
  });
}

// ---- GET /api/admin/stats ----
export async function handleStats(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const stats = await getStats(d1);
  return c.json(stats);
}

// ---- GET /api/admin/settings ----
export async function handleGetSettings(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const { results } = await d1.prepare('SELECT key, value FROM system_settings').all();
  const settings: Record<string, string> = {};
  for (const r of results ?? []) {
    settings[r.key as string] = r.value as string;
  }
  return c.json({
    default_rate_limit: parseInt(settings.default_rate_limit ?? '60'),
    enabled_providers: settings.enabled_providers ?? 'openai,gemini,claude',
    maintenance_mode: settings.maintenance_mode === 'true',
    language: settings.language ?? 'en',
  });
}

// ---- PATCH /api/admin/settings ----
export async function handlePatchSettings(c: Context): Promise<Response> {
  await authenticateAdmin(c);
  const d1 = c.get('D1');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);

  for (const [key, value] of Object.entries(body)) {
    await d1.prepare(
      'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).bind(key, String(value), now).run();
  }

  return c.json({ ok: true });
}
