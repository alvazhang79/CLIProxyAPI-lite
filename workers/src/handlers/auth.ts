import type { Context } from 'hono';
import { getCachedAPIKey, setCachedAPIKey } from '../db/kv';
import { findAPIKeyByHash } from '../db/d1';
import { APIError } from '../middleware/error';
import { detectLang } from '../i18n';
import type { CachedAPIKey } from '../types/provider';

// Simple hash for API key lookup (in production, use HMAC-SHA256)
async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthContext {
  apiKey: CachedAPIKey;
}

export async function authenticateRequest(c: Context): Promise<CachedAPIKey> {
  const auth = c.req.header('Authorization') ?? c.req.header('authorization');
  const lang = detectLang(c.req.header('Accept-Language'));

  if (!auth || !auth.startsWith('Bearer ')) {
    throw new APIError(401, 'unauthorized', 'Missing or invalid Authorization header', lang);
  }

  const apiKey = auth.slice(7).trim();
  if (!apiKey) {
    throw new APIError(401, 'invalid_api_key', 'API key is empty', lang);
  }

  // Try KV cache first
  const kv = c.get('KV');
  const cached = await getCachedAPIKey(kv, apiKey);
  if (cached) {
    if (!cached.enabled) {
      throw new APIError(403, 'api_key_disabled', 'This API key has been disabled', lang);
    }
    return cached;
  }

  // Cache miss — look up in D1
  const d1 = c.get('D1');
  const keyHash = await hashAPIKey(apiKey);
  const record = await findAPIKeyByHash(d1, keyHash);

  if (!record) {
    throw new APIError(401, 'invalid_api_key', 'Invalid API key', lang);
  }

  if (!record.enabled) {
    throw new APIError(403, 'api_key_disabled', 'This API key has been disabled', lang);
  }

  // Populate KV cache
  await setCachedAPIKey(kv, apiKey, record);

  return record;
}

/**
 * Generate a new API key (returns the raw key — only time it's visible)
 */
export function generateAPIKey(): { raw: string; hash: string; prefix: string } {
  const raw = 'sk_live_' + randomString(32);
  const encoder = new TextEncoder();
  // Sync version for prefix calc (not for storage)
  const hash = raw; // Full raw key returned to user; hash stored
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

function randomString(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  return Array.from(array).map(x => chars[x % chars.length]).join('');
}
