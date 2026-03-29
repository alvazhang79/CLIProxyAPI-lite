import type { Context, Next } from 'hono';
import { checkRateLimit } from '../db/kv';
import { APIError } from './error';
import { detectLang } from '../i18n';

export async function rateLimitMiddleware(
  c: Context,
  next: Next,
  getKeyId: () => string | null,
  getLimit: () => number,
) {
  const keyId = getKeyId();
  if (!keyId) return next(); // no rate limit if no key

  const limit = getLimit();
  if (limit <= 0) return next(); // unlimited

  const kv = c.get('KV');
  const lang = detectLang(c.req.header('accept-language'));

  const { allowed, remaining, resetAt } = await checkRateLimit(kv, keyId, limit);

  // Always set rate limit headers
  c.res.headers.set('X-RateLimit-Limit', String(limit));
  c.res.headers.set('X-RateLimit-Remaining', String(remaining));
  c.res.headers.set('X-RateLimit-Reset', String(resetAt));

  if (!allowed) {
    const retryAfter = Math.max(0, resetAt - Math.floor(Date.now() / 1000));
    c.res.headers.set('Retry-After', String(retryAfter));
    throw new APIError(429, 'rate_limit_exceeded', 'Rate limit exceeded', lang);
  }

  return next();
}
