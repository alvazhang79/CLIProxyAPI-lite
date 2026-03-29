import type { KVNamespace } from '@cloudflare/workers-types';
import type { CachedAPIKey, AdminSession } from '../types/provider';

// ---- KV Bindings ----
export type Env = {
  KV: KVNamespace;
  D1: D1Database;
};

// ---- API Key Cache ----
const API_KEY_PREFIX = 'apikey:';
const API_KEY_CACHE_TTL = 300; // 5 minutes

export async function getCachedAPIKey(
  kv: KVNamespace,
  apiKey: string,
): Promise<CachedAPIKey | null> {
  const key = API_KEY_PREFIX + apiKey.slice(0, 32);
  const val = await kv.get(key, 'json');
  return (val as CachedAPIKey) ?? null;
}

export async function setCachedAPIKey(
  kv: KVNamespace,
  apiKey: string,
  record: CachedAPIKey,
): Promise<void> {
  const key = API_KEY_PREFIX + apiKey.slice(0, 32);
  await kv.put(key, JSON.stringify(record), { expirationTtl: API_KEY_CACHE_TTL });
}

export async function invalidateAPIKeyCache(kv: KVNamespace, apiKey: string): Promise<void> {
  const key = API_KEY_PREFIX + apiKey.slice(0, 32);
  await kv.delete(key);
}

// ---- Rate Limiting ----
const RATE_LIMIT_PREFIX = 'rl:';

export async function checkRateLimit(
  kv: KVNamespace,
  keyId: string,
  limit: number,
  windowSeconds = 60,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = RATE_LIMIT_PREFIX + keyId + ':' + Math.floor(now / windowSeconds);
  const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;

  const current = await kv.get(windowKey, 'json').catch(() => null) as number | null;
  const count = (current ?? 0) + 1;

  await kv.put(windowKey, String(count), { expirationTtl: windowSeconds * 2 });

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

// ---- Admin Sessions ----
const SESSION_PREFIX = 'session:';

export async function getAdminSession(
  kv: KVNamespace,
  token: string,
): Promise<AdminSession | null> {
  const key = SESSION_PREFIX + token.slice(0, 64);
  const val = await kv.get(key, 'json').catch(() => null);
  return (val as AdminSession) ?? null;
}

export async function setAdminSession(
  kv: KVNamespace,
  token: string,
  session: AdminSession,
): Promise<void> {
  const key = SESSION_PREFIX + token.slice(0, 64);
  const ttl = Math.floor((session.expires_at - Date.now() / 1000));
  if (ttl > 0) {
    await kv.put(key, JSON.stringify(session), { expirationTtl: ttl });
  }
}

export async function deleteAdminSession(kv: KVNamespace, token: string): Promise<void> {
  const key = SESSION_PREFIX + token.slice(0, 64);
  await kv.delete(key);
}
