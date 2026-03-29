import type { D1Database } from '@cloudflare/workers-types';
import type {
  APIKeyRecord,
  CustomProvider,
  CustomModel,
  ResolvedRoute,
  APIFormat,
} from '../types/provider';
import type { CachedAPIKey } from '../types/provider';

// ---- API Key Operations ----

export async function findAPIKeyByHash(
  d1: D1Database,
  apiKey: string,
): Promise<CachedAPIKey | null> {
  // API keys are stored as SHA-256 hashes
  const stmt = d1.prepare(
    'SELECT id, key_prefix, name, provider, model, api_secret, ' +
    'embeddings_provider, embeddings_model, excluded_models, rate_limit, enabled ' +
    'FROM api_keys WHERE api_key = ? AND enabled = 1 LIMIT 1'
  );
  const result = await stmt.bind(apiKey).first();

  if (!result) return null;

  return {
    id: result.id as string,
    key_prefix: result.key_prefix as string,
    name: result.name as string,
    provider: result.provider as string,
    model: result.model as string,
    api_secret: result.api_secret as string,
    embeddings_provider: (result.embeddings_provider as string) ?? null,
    embeddings_model: (result.embeddings_model as string) ?? null,
    excluded_models: result.excluded_models
      ? JSON.parse(result.excluded_models as string)
      : [],
    rate_limit: (result.rate_limit as number) ?? 60,
    enabled: Boolean(result.enabled),
  };
}

export async function createAPIKey(
  d1: D1Database,
  record: {
    id: string; api_key: string; key_prefix: string; name: string;
    provider: string; model: string; api_secret: string;
    embeddings_provider?: string; embeddings_model?: string;
    excluded_models: string[]; rate_limit: number; enabled: boolean;
  },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const stmt = d1.prepare(
    'INSERT INTO api_keys ' +
    '(id, api_key, key_prefix, name, provider, model, api_secret, ' +
    'embeddings_provider, embeddings_model, excluded_models, rate_limit, enabled, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const result = await stmt.bind(
    record.id, record.api_key, record.key_prefix, record.name,
    record.provider, record.model, record.api_secret,
    record.embeddings_provider ?? null, record.embeddings_model ?? null,
    JSON.stringify(record.excluded_models), record.rate_limit,
    record.enabled ? 1 : 0, now, now
  ).run();
  return result.success ? record.id : '';
}

export async function listAPIKeys(d1: D1Database): Promise<Partial<APIKeyRecord>[]> {
  const stmt = d1.prepare(
    'SELECT id, key_prefix, name, provider, model, rate_limit, enabled, created_at, updated_at ' +
    'FROM api_keys ORDER BY created_at DESC'
  );
  const { results } = await stmt.all();
  return results.map(r => ({
    id: r.id as string,
    key_prefix: r.key_prefix as string,
    name: r.name as string,
    provider: r.provider as string,
    model: r.model as string,
    rate_limit: r.rate_limit as number,
    enabled: Boolean(r.enabled),
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
  }));
}

export async function deleteAPIKey(d1: D1Database, id: string): Promise<boolean> {
  const stmt = d1.prepare('DELETE FROM api_keys WHERE id = ?');
  const result = await stmt.bind(id).run();
  return result.success;
}

export async function deleteCustomProvider(d1: D1Database, id: string): Promise<boolean> {
  // Also delete associated models first
  await d1.prepare('DELETE FROM custom_models WHERE provider_id = ?').bind(id).run();
  const stmt = d1.prepare('DELETE FROM custom_providers WHERE id = ?');
  const result = await stmt.bind(id).run();
  return result.success;
}

export async function updateAPIKey(
  d1: D1Database,
  id: string,
  updates: Partial<APIKeyRecord>,
): Promise<boolean> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
  if (updates.provider !== undefined) { fields.push('provider = ?'); values.push(updates.provider); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.rate_limit !== undefined) { fields.push('rate_limit = ?'); values.push(updates.rate_limit); }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));
  values.push(id);

  const stmt = d1.prepare('UPDATE api_keys SET ' + fields.join(', ') + ' WHERE id = ?');
  const result = await stmt.bind(...values).run();
  return result.success;
}

// ---- Custom Provider Operations ----

export async function findCustomProviderByName(
  d1: D1Database,
  name: string,
): Promise<CustomProvider | null> {
  const stmt = d1.prepare(
    'SELECT * FROM custom_providers WHERE name = ? AND enabled = 1 LIMIT 1'
  );
  const r = await stmt.bind(name).first();
  if (!r) return null;
  return parseCustomProvider(r);
}

export async function findCustomProviderById(
  d1: D1Database,
  id: string,
): Promise<CustomProvider | null> {
  const stmt = d1.prepare('SELECT * FROM custom_providers WHERE id = ? LIMIT 1');
  const r = await stmt.bind(id).first();
  if (!r) return null;
  return parseCustomProvider(r);
}

export async function listCustomProviders(d1: D1Database): Promise<CustomProvider[]> {
  const stmt = d1.prepare('SELECT * FROM custom_providers ORDER BY created_at DESC');
  const { results } = await stmt.all();
  return results.map(parseCustomProvider);
}

export async function createCustomProvider(
  d1: D1Database,
  p: CustomProvider,
): Promise<boolean> {
  const stmt = d1.prepare(
    'INSERT INTO custom_providers ' +
    '(id, name, display_name, base_url, auth_type, auth_header, headers, proxy_url, enabled, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const result = await stmt.bind(
    p.id, p.name, p.display_name, p.base_url, p.auth_type, p.auth_header,
    JSON.stringify(p.headers), p.proxy_url, p.enabled ? 1 : 0, p.created_at, p.updated_at
  ).run();
  return result.success;
}

function parseCustomProvider(r: Record<string, unknown>): CustomProvider {
  return {
    id: r.id as string,
    name: r.name as string,
    display_name: r.display_name as string,
    base_url: r.base_url as string,
    auth_type: r.auth_type as 'bearer' | 'api_key' | 'custom',
    auth_header: r.auth_header as string,
    headers: r.headers ? JSON.parse(r.headers as string) : {},
    proxy_url: (r.proxy_url as string) ?? '',
    enabled: Boolean(r.enabled),
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
  };
}

// ---- Custom Model Operations ----

export async function findModelByAlias(
  d1: D1Database,
  alias: string,
): Promise<CustomModel | null> {
  const stmt = d1.prepare(
    'SELECT * FROM custom_models WHERE alias = ? AND enabled = 1 LIMIT 1'
  );
  const r = await stmt.bind(alias).first();
  if (!r) return null;
  return parseCustomModel(r);
}

export async function listModelsByProvider(
  d1: D1Database,
  providerId: string,
): Promise<CustomModel[]> {
  const stmt = d1.prepare(
    'SELECT * FROM custom_models WHERE provider_id = ? ORDER BY created_at DESC'
  );
  const { results } = await stmt.bind(providerId).all();
  return results.map(parseCustomModel);
}

export async function listAllModels(d1: D1Database): Promise<CustomModel[]> {
  const stmt = d1.prepare('SELECT * FROM custom_models ORDER BY created_at DESC');
  const { results } = await stmt.all();
  return results.map(parseCustomModel);
}

function parseCustomModel(r: Record<string, unknown>): CustomModel {
  return {
    id: r.id as string,
    provider_id: r.provider_id as string,
    model: r.model as string,
    alias: r.alias as string,
    display_name: (r.display_name as string) ?? '',
    api_format: (r.api_format as APIFormat) ?? 'openai',
    supports_streaming: Boolean(r.supports_streaming),
    supports_functions: Boolean(r.supports_functions),
    context_window: (r.context_window as number) ?? null,
    enabled: Boolean(r.enabled),
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
  };
}

// ---- Model Resolution ----
// Tries: custom alias → built-in model name → null
export async function resolveRoute(
  d1: D1Database,
  model: string,
): Promise<ResolvedRoute | null> {
  // 1. Try custom alias first
  const customModel = await findModelByAlias(d1, model);
  if (customModel) {
    const provider = await findCustomProviderById(d1, customModel.provider_id);
    if (provider && provider.enabled) {
      return {
        provider,
        upstream_model: customModel.model,
        api_format: customModel.api_format,
        supports_streaming: customModel.supports_streaming,
        supports_functions: customModel.supports_functions,
      };
    }
  }

  // 2. Try built-in provider lookup
  const builtin = resolveBuiltinModel(model);
  if (builtin) return builtin;

  return null;
}

// Built-in model registry
const BUILTIN_MODELS: Record<string, ResolvedRoute> = {
  // OpenAI
  'gpt-4o': {
    provider: 'openai',
    upstream_model: 'gpt-4o',
    api_format: 'openai',
    supports_streaming: true,
    supports_functions: true,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    upstream_model: 'gpt-4o-mini',
    api_format: 'openai',
    supports_streaming: true,
    supports_functions: true,
  },
  'gpt-4-turbo': {
    provider: 'openai',
    upstream_model: 'gpt-4-turbo',
    api_format: 'openai',
    supports_streaming: true,
    supports_functions: true,
  },
  // Gemini
  'gemini-2.5-pro': {
    provider: 'gemini',
    upstream_model: 'gemini-2.5-pro-exp-03-25',
    api_format: 'gemini',
    supports_streaming: true,
    supports_functions: true,
  },
  'gemini-2.5-flash': {
    provider: 'gemini',
    upstream_model: 'gemini-2.5-flash',
    api_format: 'gemini',
    supports_streaming: true,
    supports_functions: true,
  },
  // Claude
  'claude-3-5-sonnet': {
    provider: 'claude',
    upstream_model: 'claude-3-5-sonnet-20241022',
    api_format: 'claude',
    supports_streaming: true,
    supports_functions: true,
  },
  'claude-3-5-haiku': {
    provider: 'claude',
    upstream_model: 'claude-3-5-haiku-20241022',
    api_format: 'claude',
    supports_streaming: true,
    supports_functions: true,
  },
  // Cohere (for embeddings)
  'embed-english-v3.0': {
    provider: 'cohere',
    upstream_model: 'embed-english-v3.0',
    api_format: 'cohere',
    supports_streaming: false,
    supports_functions: false,
  },
};

export function resolveBuiltinModel(model: string): ResolvedRoute | null {
  return BUILTIN_MODELS[model] ?? null;
}

export function getBuiltinModels(): Array<{ id: string; object: string; type: string; display_name: string }> {
  return Object.entries(BUILTIN_MODELS).map(([id, r]) => ({
    id,
    object: 'model',
    type: 'chat',
    display_name: id,
  }));
}

// ---- Embeddings Storage ----

export async function storeEmbedding(
  d1: D1Database,
  id: string,
  apiKeyId: string,
  text: string,
  vector: number[],
  model: string,
  metadata: Record<string, string> | null,
): Promise<boolean> {
  // Convert number[] to Float32Array bytes
  const float32 = new Float32Array(vector);
  const bytes = new Uint8Array(float32.buffer);

  const stmt = d1.prepare(
    'INSERT INTO embeddings_index (id, api_key_id, text, vector, model, metadata, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = await stmt.bind(
    id, apiKeyId, text, bytes, model,
    metadata ? JSON.stringify(metadata) : null,
    Math.floor(Date.now() / 1000)
  ).run();
  return result.success;
}

// ---- Request Logs ----

export async function insertRequestLog(
  d1: D1Database,
  log: Omit<import('../types/provider').RequestLog, 'id' | 'created_at'>,
): Promise<void> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const stmt = d1.prepare(
    'INSERT INTO request_logs ' +
    '(id, api_key_id, endpoint, provider, model, tokens_used, latency_ms, status_code, error_msg, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  await stmt.bind(
    id, log.api_key_id, log.endpoint, log.provider, log.model,
    log.tokens_used, log.latency_ms, log.status_code, log.error_msg, now
  ).run();
}

// ---- Stats ----

export async function getStats(d1: D1Database): Promise<{
  total_keys: number;
  requests_today: number;
  requests_by_provider: Record<string, number>;
  error_rate: number;
  avg_latency_ms: number;
}> {
  const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

  const [keysResult, logsResult] = await Promise.all([
    d1.prepare('SELECT COUNT(*) as cnt FROM api_keys').first(),
    d1.prepare(
      'SELECT COUNT(*) as total, ' +
      'SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors, ' +
      'AVG(latency_ms) as avg_lat ' +
      'FROM request_logs WHERE created_at >= ?'
    ).bind(today).first(),
    d1.prepare(
      'SELECT provider, COUNT(*) as cnt FROM request_logs ' +
      'WHERE created_at >= ? GROUP BY provider'
    ).bind(today).all(),
  ]);

  const byProvider: Record<string, number> = {};
  if (Array.isArray(logsResult)) {
    for (const row of logsResult as Record<string, unknown>[]) {
      byProvider[row.provider as string] = row.cnt as number;
    }
  }

  return {
    total_keys: (keysResult?.cnt as number) ?? 0,
    requests_today: (logsResult?.total as number) ?? 0,
    requests_by_provider: byProvider,
    error_rate: logsResult
      ? ((logsResult.errors as number) ?? 0) / Math.max((logsResult.total as number) ?? 1, 1)
      : 0,
    avg_latency_ms: (logsResult?.avg_lat as number) ?? 0,
  };
}
