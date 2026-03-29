// Shared types for Pages Functions
import type { KVNamespace } from '@cloudflare/workers-types';

export interface APIEnv {
  KV: KVNamespace;
  D1: D1Database;
  ADMIN_TOKEN: string;
  ADMIN_TOKEN_HASH?: string;  // bcrypt hash in production
  ENCRYPTION_KEY?: string;    // AES-256 key, base64
  WORKERS_API_URL?: string;
}
