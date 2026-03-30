// ============================================================
// Provider Types
// ============================================================

// Built-in provider names
export type BuiltinProvider = 'openai' | 'gemini' | 'claude' | 'qwen' | 'cohere';

// API format for translation
export type APIFormat = 'openai' | 'gemini' | 'claude' | 'cohere';

export interface CustomProvider {
  id: string;
  name: string;            // internal name e.g. "openrouter"
  display_name: string;     // e.g. "OpenRouter"
  base_url: string;         // e.g. "https://openrouter.ai/api/v1"
  auth_type: 'bearer' | 'api_key' | 'custom';
  auth_header: string;      // e.g. "Authorization" or "X-API-Key"
  headers: Record<string, string>;
  proxy_url: string;
  encrypted_credentials: string; // encrypted provider API key
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

// Provider API Key for multi-key load balancing
export interface ProviderAPIKey {
  id: string;
  provider_id: string;
  name: string;
  api_key: string;         // encrypted
  priority: number;         // lower = higher priority
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface CustomModel {
  id: string;
  provider_id: string;
  model: string;           // upstream actual model name
  alias: string;           // client-facing name
  display_name: string;
  api_format: APIFormat;
  supports_streaming: boolean;
  supports_functions: boolean;
  context_window: number | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

// Resolved route info after alias lookup
export interface ResolvedRoute {
  provider: CustomProvider | BuiltinProvider;
  upstream_model: string;
  api_format: APIFormat;
  supports_streaming: boolean;
  supports_functions: boolean;
}

// API Key record (stored in D1)
export interface APIKeyRecord {
  id: string;
  api_key: string;         // hashed
  key_prefix: string;      // first 12 chars
  name: string;
  provider: string;        // provider name or "custom:<id>"
  model: string;          // default model (alias or real)
  allowed_models: string[];  // list of allowed model aliases; if empty, allow all (backward compat)
  api_secret: string;      // encrypted upstream key
  embeddings_provider?: string;
  embeddings_model?: string;
  excluded_models: string[];
  rate_limit: number;      // req/min
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

// Admin session record
export interface AdminSession {
  id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
}

// Request log record
export interface RequestLog {
  id: string;
  api_key_id: string;
  endpoint: string;
  provider: string;
  model: string;
  tokens_used: number | null;
  latency_ms: number | null;
  status_code: number | null;
  error_msg: string | null;
  created_at: number;
}

// KV Cache entries
export interface CachedAPIKey {
  id: string;
  key_prefix: string;
  name: string;
  provider: string;
  model: string;
  allowed_models: string[];  // list of allowed model aliases; if empty, allow all (backward compat)
  api_secret: string;
  embeddings_provider: string | null;
  embeddings_model: string | null;
  excluded_models: string[];
  rate_limit: number;
  enabled: boolean;
}
