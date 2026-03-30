import type { D1Database } from '@cloudflare/workers-types';
import { OpenAICompatibleProvider } from './openai';
import type { CustomProvider, CachedAPIKey, ResolvedRoute } from '../types/provider';
import { resolveBuiltinModel } from '../db/d1';
import { detectLang } from '../i18n';
import { APIError } from '../middleware/error';

// Built-in provider configs
const BUILTIN_PROVIDERS: Record<string, { baseUrl: string; authType: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    authType: 'Bearer',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'Bearer',
  },
  claude: {
    baseUrl: 'https://api.anthropic.com',
    authType: 'Bearer',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com',
    authType: 'Bearer',
  },
  cohere: {
    baseUrl: 'https://api.cohere.ai',
    authType: 'Bearer',
  },
};

/**
 * Build the appropriate provider instance based on resolved route.
 */
export function buildProvider(
  route: ResolvedRoute,
  apiSecret: string,
  customProvider?: CustomProvider | null,
): OpenAICompatibleProvider {
  let baseUrl: string;
  let authHeader = 'Authorization';
  let extraHeaders: Record<string, string> = {};

  if (customProvider) {
    baseUrl = customProvider.base_url;
    authHeader = customProvider.auth_header || 'Authorization';
    extraHeaders = customProvider.headers || {};
  } else {
    const builtin = BUILTIN_PROVIDERS[route.provider as string];
    if (!builtin) {
      throw new APIError(500, 'server_error', 'Unknown provider: ' + route.provider, detectLang(null));
    }
    baseUrl = builtin.baseUrl;
  }

  const authValue = authHeader === 'Authorization' && !apiSecret.startsWith('Bearer ')
    ? `Bearer ${apiSecret}`
    : apiSecret;

  return new OpenAICompatibleProvider(
    baseUrl,
    authValue,
    authHeader,
    extraHeaders,
    customProvider?.proxy_url || undefined,
  );
}

/**
 * Get the provider for a cached API key record.
 */
export async function getProviderForAPIKey(
  d1: D1Database,
  keyRecord: CachedAPIKey,
): Promise<{ route: ResolvedRoute; provider: OpenAICompatibleProvider }> {
  // Check if it's a custom provider reference
  let route: ResolvedRoute | null = null;
  let customProvider: CustomProvider | null = null;

  if (keyRecord.provider.startsWith('custom:')) {
    const providerId = keyRecord.provider.slice(7);
    // Load custom provider from D1
    const stmt = d1.prepare('SELECT * FROM custom_providers WHERE id = ? AND enabled = 1 LIMIT 1');
    const r = await stmt.bind(providerId).first().catch(() => null) as Record<string, unknown> | null;
    if (!r) {
      throw new APIError(500, 'server_error', 'Custom provider not found', detectLang(null));
    }
    customProvider = {
      id: r.id as string,
      name: r.name as string,
      display_name: r.display_name as string,
      base_url: r.base_url as string,
      auth_type: r.auth_type as 'bearer' | 'api_key' | 'custom',
      auth_header: r.auth_header as string,
      headers: r.headers ? JSON.parse(r.headers as string) : {},
      proxy_url: (r.proxy_url as string) ?? '',
      encrypted_credentials: (r.encrypted_credentials as string) ?? '',
      enabled: Boolean(r.enabled),
      created_at: r.created_at as number,
      updated_at: r.updated_at as number,
    };

    // Look up the default model from custom_models
    const modelStmt = d1.prepare(
      'SELECT * FROM custom_models WHERE alias = ? AND provider_id = ? AND enabled = 1 LIMIT 1'
    );
    const mr = await modelStmt.bind(keyRecord.model, providerId).first().catch(() => null) as Record<string, unknown> | null;

    route = mr
      ? {
          provider: customProvider,
          upstream_model: mr.model as string,
          api_format: (mr.api_format as 'openai') ?? 'openai',
          supports_streaming: Boolean(mr.supports_streaming),
          supports_functions: Boolean(mr.supports_functions),
        }
      : resolveBuiltinModel(keyRecord.model);

    if (!route) {
      throw new APIError(400, 'model_not_found', `Model ${keyRecord.model} not found`, detectLang(null));
    }
  } else {
    route = resolveBuiltinModel(keyRecord.model);
    if (!route) {
      // Try generic openai-compatible
      route = {
        provider: keyRecord.provider as 'openai',
        upstream_model: keyRecord.model,
        api_format: 'openai',
        supports_streaming: true,
        supports_functions: true,
      };
    }
  }

  const provider = buildProvider(route, keyRecord.api_secret, customProvider);
  return { route, provider };
}
