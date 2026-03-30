// API client for Pages → Workers admin endpoints

const WORKERS_URL = import.meta.env.VITE_WORKERS_API_URL ?? '';

function getSessionToken(): string | null {
  return localStorage.getItem('session_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(WORKERS_URL + path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    localStorage.removeItem('session_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---- Admin API ----

export const adminApi = {
  // Auth
  login: (token: string) =>
    request<{ ok: boolean; token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }),

  // API Keys
  listKeys: () =>
    request<{ keys: APIKey[] }>('/api/admin/keys'),

  createKey: (body: CreateKeyBody) =>
    request<APIKey>('/api/admin/keys', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteKey: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/keys/${id}`, { method: 'DELETE' }),

  toggleKey: (id: string, enabled: boolean) =>
    request<{ ok: boolean }>(`/api/admin/keys/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  // Providers
  listProviders: () =>
    request<{ providers: Provider[] }>('/api/admin/providers'),

  createProvider: (body: CreateProviderBody) =>
    request<Provider>('/api/admin/providers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteProvider: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/providers/${id}`, { method: 'DELETE' }),

  // Models
  listModels: () =>
    request<{ models: Model[] }>('/api/admin/models'),

  createModel: (body: CreateModelBody) =>
    request<Model>('/api/admin/models', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteModel: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/models/${id}`, { method: 'DELETE' }),

  importPreset: (providerId: string, preset: string) =>
    request<{ added: number; skipped: number }>('/api/admin/models/presets', {
      method: 'POST',
      body: JSON.stringify({ provider_id: providerId, preset }),
    }),

  // Embeddings
  listEmbeddings: (params: { api_key_id?: string; q?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.api_key_id) qs.set('api_key_id', params.api_key_id);
    if (params.q) qs.set('q', params.q);
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{ results: Embedding[] }>('/api/admin/embeddings?' + qs);
  },

  deleteEmbedding: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/embeddings/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () =>
    request<Stats>('/api/admin/stats'),

  // Settings
  getSettings: () =>
    request<Settings>('/api/admin/settings'),

  updateSettings: (body: Partial<Settings>) =>
    request<{ ok: boolean }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Logs
  getLogs: (params: {
    provider?: string;
    endpoint?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.provider) qs.set('provider', params.provider);
    if (params.endpoint) qs.set('endpoint', params.endpoint);
    if (params.status) qs.set('status', params.status);
    if (params.page !== undefined) qs.set('page', String(params.page));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    return request<{ logs: LogEntry[]; total: number; has_more: boolean }>(
      '/api/admin/logs?' + qs.toString()
    );
  },
};

// ---- Types ----

export interface APIKey {
  id: string;
  key_prefix: string;
  name: string;
  provider: string;
  model: string;
  embeddings_model?: string;
  rate_limit: number;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateKeyBody {
  name: string;
  provider: string;
  model: string;
  api_secret: string;
  embeddings_model?: string;
  rate_limit?: number;
}

export interface Provider {
  id: string;
  name: string;
  display_name: string;
  base_url: string;
  auth_type: 'bearer' | 'api_key' | 'custom';
  auth_header: string;
  headers: Record<string, string>;
  proxy_url: string;
  enabled: boolean;
  model_count?: number;
}

export interface CustomProvider extends Provider {}

export interface CreateProviderBody {
  name: string;
  display_name: string;
  base_url: string;
  auth_type?: 'bearer' | 'api_key' | 'custom';
  auth_header?: string;
  headers?: Record<string, string>;
  proxy_url?: string;
}

export interface Model {
  id: string;
  alias: string;
  display_name: string;
  model: string;
  provider_id: string;
  api_format: 'openai' | 'gemini' | 'claude' | 'cohere';
  supports_streaming: boolean;
  supports_functions: boolean;
  context_window: number | null;
  enabled: boolean;
}

export interface CreateModelBody {
  provider_id: string;
  model: string;
  alias: string;
  display_name?: string;
  api_format?: 'openai' | 'gemini' | 'claude' | 'cohere';
  context_window?: number;
  supports_streaming?: boolean;
  supports_functions?: boolean;
}

export interface Embedding {
  id: string;
  text: string;
  model: string;
  metadata: Record<string, string> | null;
  created_at: number;
  score?: number;
}

export interface Stats {
  total_keys: number;
  requests_today: number;
  requests_by_provider: Record<string, number>;
  error_rate: number;
  avg_latency_ms: number;
}

export interface Settings {
  default_rate_limit: number;
  enabled_providers: string;
  maintenance_mode: boolean;
  language: 'en' | 'zh';
}

export interface LogEntry {
  id: string;
  api_key_id: string;
  key_name?: string;
  endpoint: string;
  provider: string;
  model: string;
  tokens_used: number | null;
  latency_ms: number | null;
  status_code: number | null;
  error_msg: string | null;
  created_at: number;
}
