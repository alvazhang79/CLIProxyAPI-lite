import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { handleChatCompletions } from './handlers/chat';
import { handleEmbeddings } from './handlers/embeddings';
import { handleListModels } from './handlers/models';
import {
  handleAdminLogin, handleAdminLogout,
  handleListKeys, handleCreateKey, handleDeleteKey, handlePatchKey,
  handleListProviders, handleCreateProvider, handleDeleteProvider,
  handleListModels as handleAdminListModels, handleCreateModel, handleDeleteModel,
  handleListEmbeddings, handleDeleteEmbedding,
  handleStats, handleGetSettings, handlePatchSettings,
  handleListLogs,
} from './handlers/admin';
import { errorMiddleware, APIError } from './middleware/error';
import type { KVNamespace } from '@cloudflare/workers-types';

// Define Bindings type explicitly
type Bindings = {
  KV: KVNamespace;
  D1: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// ---- Middleware ----
app.use('*', cors({
  origin: (origin) => origin, // Must echo back specific origin when credentials: include
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-Id'],
  credentials: true, // Required for cross-origin cookie sessions
  maxAge: 86400,
}));

app.use('*', logger());

// Inject KV/D1 into context via middleware
app.use('*', async (c, next) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c as any).set('KV', c.env.KV);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c as any).set('D1', c.env.D1);
  await next();
});

// ---- Health Check ----
app.get('/health', c => c.json({ status: 'ok', timestamp: Math.floor(Date.now() / 1000) }));





// ---- API Routes ----

// POST /v1/chat/completions
app.post('/v1/chat/completions', handleChatCompletions);
app.post('/v1/chat/completion', handleChatCompletions); // alias

// POST /v1/embeddings ✨
app.post('/v1/embeddings', handleEmbeddings);
app.post('/v1/embedding', handleEmbeddings);

// GET /v1/models
app.get('/v1/models', handleListModels);
app.get('/v1beta/models', handleListModels); // Gemini compatibility

// ---- Admin API Routes ----

// Auth
app.post('/api/admin/login', handleAdminLogin);
app.post('/api/admin/logout', handleAdminLogout);

// API Keys
app.get('/api/admin/keys', handleListKeys);
app.post('/api/admin/keys', handleCreateKey);
app.delete('/api/admin/keys/:id', handleDeleteKey);
app.patch('/api/admin/keys/:id', handlePatchKey);

// Providers
app.get('/api/admin/providers', handleListProviders);
app.post('/api/admin/providers', handleCreateProvider);
app.delete('/api/admin/providers/:id', handleDeleteProvider);

// Models
app.get('/api/admin/models', handleAdminListModels);
app.post('/api/admin/models', handleCreateModel);
app.delete('/api/admin/models/:id', handleDeleteModel);

// Embeddings
app.get('/api/admin/embeddings', handleListEmbeddings);
app.delete('/api/admin/embeddings/:id', handleDeleteEmbedding);

// Stats & Settings
app.get('/api/admin/stats', handleStats);
app.get('/api/admin/logs', handleListLogs);
app.get('/api/admin/settings', handleGetSettings);
app.patch('/api/admin/settings', handlePatchSettings);

// ---- Fallback handler for non-chat endpoints ----
app.notFound(c => {
  const lang = c.req.header('accept-language');
  const l = lang?.includes('zh') ? 'zh' : 'en';
  return new APIError(404, 'not_found', 'Endpoint not found', l).toResponse();
});

// Global error handler
app.onError((err, c) => {
  if (err instanceof APIError) {
    return err.toResponse();
  }
  console.error('[Worker Error]', err);
  const lang = c.req.header('accept-language');
  const l = lang?.includes('zh') ? 'zh' : 'en';
  const body = {
    error: {
      message: 'Internal server error',
      type: 'internal_error',
      code: 'server_error',
      param: null as null,
    },
  };
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
});

// @ts-ignore - Hono export
export default app;
