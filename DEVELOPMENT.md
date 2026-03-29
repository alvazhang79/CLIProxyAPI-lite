# CLIProxyAPI Lite — Development Document

> **Slogan / 标语:** _"Lightweight AI Gateway, Powered by Edge"_
> **中文:** 轻量 AI 网关，边缘驱动

---

## 1. Project Overview / 项目概述

### 1.1 What It Is / 是什么

**CLIProxyAPI Lite** is a lightweight, edge-native AI API gateway built on Cloudflare Workers and Pages. It proxies and translates requests between OpenAI/Gemini/Claude-compatible clients and multiple upstream AI providers (official APIs, CLI subscriptions, third-party relays), supporting not only chat/completion endpoints but also **text embeddings** — something the original CLIProxyAPI lacks.

**CLIProxyAPI Lite** 是一个轻量级、边缘化的 AI API 网关，基于 Cloudflare Workers 和 Pages 构建。它代理并转换 OpenAI/Gemini/Claude 兼容客户端的请求，透传至多个上游 AI 提供商（官方 API、CLI 订阅、第三方转发），不仅支持 chat/completion 端点，还支持 **文本 embeddings**（这是原始 CLIProxyAPI 所缺乏的）。

### 1.2 Core Philosophy / 核心理念

- **Lightweight / 轻量:** Minimal cold start, global edge deployment, no server to maintain.
- **Free & Open / 自由开源:** Community-driven, transparent routing logic.
- **Multi-Provider Unified / 多提供商统一:** One endpoint, multiple backends — pick by API key.
- **Developer-First / 开发者优先:** OpenAI-compatible API surface, SDK-agnostic, works with any HTTP client.

### 1.3 Target Users / 目标用户

| User Type | Scenario |
|-----------|----------|
| Individual developers | Access free CLI subscriptions (Gemini 2.5 Pro, GPT-5, Claude) via API without managing CLI tools |
| Startups / Small teams | Cost-effective AI gateway with per-key LLM routing |
| RAG application builders | Need both chat/completion AND embeddings from the same gateway |
| CF Workers power users | Want a self-hosted, serverless AI proxy with zero infrastructure |

---

## 2. Architecture / 架构设计

### 2.1 High-Level Architecture

```
                              ┌─────────────────┐
                              │   Cloudflare    │
                              │     Pages       │  ← Admin Web UI (React)
                              └────────┬────────┘
                                       │ REST API
                              ┌────────▼────────┐
                              │  Cloudflare     │  ← Auth Middleware
                              │  Workers        │    (API Key Validation)
                              │  (API Gateway)  │    (Rate Limiting)
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼─────────┐    ┌────────▼────────┐    ┌────────▼────────┐
    │   Workers KV      │    │   CF D1          │    │  CF Queue       │
    │   (Token Cache)   │    │   (API Keys,     │    │  (Async Jobs,   │
    │                   │    │    Embeddings)   │    │   Webhooks)     │
    └───────────────────┘    └──────────────────┘    └──────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        │                             │
              ┌─────────▼─────────┐         ┌────────▼────────┐
              │  OpenAI API       │         │  Gemini CLI     │
              │  (text-embedding  │         │  (OAuth sess)  │
              │   models)         │         ├─────────────────┤
              │                    │         │  Claude Code   │
              │                    │         │  (OAuth sess)  │
              │                    │         ├─────────────────┤
              │                    │         │  Qwen Code      │
              │                    │         │  (OAuth sess)  │
              └────────────────────┘         └─────────────────┘
```

### 2.2 Project Structure

```
/home/projects/cliproxyapi-lite/
├── workers/                        # Cloudflare Workers (API Gateway)
│   ├── src/
│   │   ├── index.ts               # Worker entry point
│   │   ├── router.ts              # Request router
│   │   ├── handlers/
│   │   │   ├── chat.ts            # /v1/chat/completions
│   │   │   ├── completions.ts     # /v1/completions
│   │   │   ├── messages.ts        # /v1/messages
│   │   │   ├── embeddings.ts      # /v1/embeddings  ✨ NEW
│   │   │   ├── models.ts          # /v1/models
│   │   │   └── auth.ts            # API key validation
│   │   ├── translators/           # Request/response format translators
│   │   │   ├── openai.ts          # OpenAI ↔ internal
│   │   │   ├── gemini.ts          # Gemini ↔ internal
│   │   │   ├── claude.ts          # Claude ↔ internal
│   │   │   └── cohere.ts          # Cohere (for embeddings)
│   │   ├── providers/             # Upstream provider connectors
│   │   │   ├── openai.ts
│   │   │   ├── gemini.ts
│   │   │   ├── claude.ts
│   │   │   └── index.ts           # Provider registry
│   │   ├── db/
│   │   │   ├── kv.ts              # Workers KV helpers
│   │   │   └── d1.ts              # CF D1 helpers
│   │   ├── i18n/
│   │   │   ├── index.ts           # i18n router
│   │   │   ├── zh.ts              # Chinese strings
│   │   │   └── en.ts              # English strings
│   │   ├── middleware/
│   │   │   ├── ratelimit.ts       # Per-key rate limiting
│   │   │   ├── logging.ts         # Request/response logging
│   │   │   └── error.ts           # Unified error handler
│   │   └── types/
│   │       ├── api.ts             # API request/response types
│   │       └── provider.ts         # Provider config types
│   ├── wrangler.toml
│   └── tsconfig.json
│
├── pages/                          # Cloudflare Pages (Admin UI)
│   ├── src/
│   │   ├── App.tsx                # React root
│   │   ├── pages/
│   │   │   ├── Login.tsx          # Admin login
│   │   │   ├── Dashboard.tsx      # Overview
│   │   │   ├── ApiKeys.tsx        # API key management
│   │   │   ├── Models.tsx         # Model config
│   │   │   ├── Embeddings.tsx     # Embeddings management ✨ NEW
│   │   │   ├── Settings.tsx       # System settings
│   │   │   └── Logs.tsx           # Request logs
│   │   ├── components/
│   │   │   ├── Layout.tsx         # Admin layout
│   │   │   ├── Navbar.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Form.tsx
│   │   ├── hooks/
│   │   │   ├── useApi.ts          # API fetch wrapper
│   │   │   ├── useAuth.ts         # Auth context
│   │   │   └── useLang.ts         # i18n hook
│   │   ├── i18n/
│   │   │   ├── index.ts
│   │   │   ├── zh.json
│   │   │   └── en.json
│   │   └── lib/
│   │       └── api.ts             # Workers API client
│   ├── public/
│   │   └── logo.svg               # Project logo
│   ├── functions/
│   │   └── api/
│   │       └── [...slug].ts        # Pages Functions (admin API)
│   ├── wrangler.toml
│   └── package.json
│
├── scripts/
│   ├── init-d1.sql                 # D1 database schema
│   └── seed.ts                    # Seed initial data
│
├── docs/
│   ├── API.md                      # API reference
│   ├── DEPLOY.md                   # Deployment guide
│   └── LOGO.md                     # Logo design spec
│
├── README.md
├── README_ZH.md
├── package.json
└── SPEC.md                         # This file
```

---

## 3. Core Features / 核心功能

### 3.1 API Gateway (Workers)

#### 3.1.1 Supported Endpoints

| Endpoint | Status | Description |
|----------|--------|-------------|
| `POST /v1/chat/completions` | ✅ | Chat completion (OpenAI/Gemini/Claude format) |
| `POST /v1/completions` | ✅ | Text completion |
| `POST /v1/messages` | ✅ | Anthropic messages API |
| **`POST /v1/embeddings`** | ✅ **NEW** | Text embeddings (OpenAI format) |
| `GET /v1/models` | ✅ | List available models |
| `GET /v1beta/models` | ✅ | Gemini model list |
| `GET /health` | ✅ | Health check |

#### 3.1.2 API Key → LLM Routing

Each API key is bound to a specific LLM configuration. The gateway resolves the key to its provider and model at runtime.

**D1 Schema: `api_keys`**

```sql
CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,        -- UUID
  api_key     TEXT NOT NULL UNIQUE,    -- Hashed API key shown to user
  key_prefix  TEXT NOT NULL,           -- First 8 chars for identification
  name        TEXT NOT NULL,           -- Friendly name (e.g. "John's Gemini")
  provider    TEXT NOT NULL,           -- openai | gemini | claude | qwen | cohere
  model       TEXT NOT NULL,           -- Model name (e.g. "gemini-2.5-pro")
  api_secret  TEXT NOT NULL,            -- Upstream API key (encrypted at rest)
  embeddings_model TEXT,               -- Dedicated embedding model for this key ✨
  rate_limit  INTEGER DEFAULT 60,      -- Requests per minute
  enabled     INTEGER DEFAULT 1,        -- 1=active, 0=disabled
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE embeddings_index (
  id          TEXT PRIMARY KEY,
  api_key_id  TEXT NOT NULL,           -- FK to api_keys.id
  text        TEXT NOT NULL,           -- Original text
  vector      BLOB NOT NULL,           -- Float32 array (stored as bytes)
  metadata    TEXT,                    -- JSON metadata
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);
```

**Request Flow:**

```
Client Request
    │
    │  Header: Authorization: Bearer sk_xxxxx
    ▼
[API Key Validation (KV cache)]
    │
    ▼
[Lookup api_key → provider + model (D1, cached in KV)]
    │
    ▼
[Format Translator (OpenAI → target provider format)]
    │
    ▼
[Upstream Provider HTTP Call]
    │
    ▼
[Response Translator (provider → OpenAI format)]
    │
    ▼
Client Response
```

#### 3.1.3 Embeddings Flow

```
POST /v1/embeddings
  Header: Authorization: Bearer sk_xxx
  Body: { "model": "text-embedding-3-small", "input": "hello world" }

    → Lookup api_key → find embeddings_model or use provided model
    → Route to provider (OpenAI / Cohere / custom)
    → Return OpenAI-compatible embedding response

POST /v1/embeddings (with local storage)
  Body: { "model": "text-embedding-3-small", "input": "hello", "index": true }

    → Same as above, PLUS store vector in D1 (embeddings_index table)
    → Return { ..., "index": <local_db_id> }
```

#### 3.1.4 Provider Configuration

Each provider has its own config section in `wrangler.toml` secrets / D1:

```typescript
interface ProviderConfig {
  name: 'openai' | 'gemini' | 'claude' | 'qwen' | 'cohere';
  baseUrl: string;           // Upstream base URL
  authType: 'bearer' | 'api_key' | 'oauth';  // Auth method
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  models: string[];          // Available model names
  embeddingModels: string[];  // Available embedding models ✨
  defaultModel: string;
}
```

### 3.2 Admin Web (Pages)

#### 3.2.1 Authentication

- **Admin Login:** Single-token model (not user accounts)
- Token set via `ADMIN_TOKEN` environment variable / CF variable
- Login page: `POST /api/admin/login` with `{ token: "..." }`
- Session stored in `session` KV namespace (24h expiry)
- All `/api/admin/*` routes require valid session cookie

**D1 Schema: `admin_sessions`**

```sql
CREATE TABLE admin_sessions (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL,          -- SHA-256 of session token
  expires_at  INTEGER NOT NULL,        -- Unix timestamp
  created_at  INTEGER NOT NULL
);
```

#### 3.2.2 Admin Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Token-based login |
| Dashboard | `/` | Stats: total keys, requests today, error rate |
| API Keys | `/keys` | CRUD for API keys, bind to providers/models |
| Models | `/models` | View/configure available models per provider |
| Embeddings | `/embeddings` | Browse/search stored embeddings ✨ |
| Settings | `/settings` | Language toggle, rate limits, branding |
| Logs | `/logs` | Request logs with filtering |

#### 3.2.3 Multi-Language (i18n)

- Languages: **English (en)** / **中文 (zh)**
- Toggle in Settings page + URL param (`?lang=zh`)
- All UI strings externalized to JSON files
- `Accept-Language` header auto-detection on first visit

---

## 4. Custom Providers & Models / 自定义提供商与模型 ✨

> This is the most powerful feature differentiating CLIProxyAPI Lite from the original project. It allows administrators to define any OpenAI-compatible upstream relay — including custom base URLs, HTTP headers, model aliases, and per-key routing rules — entirely through the API without redeploying the Workers code.

### 4.1 Concept: Three-Layer Architecture

Inspired by CLIProxyAPI's executor/translator/model-registry pattern, adapted for TypeScript + Cloudflare Workers:

```
Request arrives: POST /v1/chat/completions
    model: "my-kimi-k2"
    │
    ▼
[1. ROUTING LAYER]  ── Match model/alias ──→  Provider entry
    │
    ▼
[2. FORMAT TRANSLATOR]  ── Convert ──→  Provider-specific request format
    (OpenAI JSON ↔ Provider JSON)
    │
    ▼
[3. EXECUTOR]  ── HTTP call ──→  Upstream baseUrl + headers
    │
    ▼
Response ── Reverse Translate ──→ OpenAI-compatible JSON
```

### 4.2 Custom Provider / 自定义提供商

A **Provider** defines how to reach an upstream AI service. Users can add any OpenAI-compatible relay (OpenRouter, iFlow, custom Clash node, etc.) via admin API.

#### D1 Schema: `custom_providers`

```sql
CREATE TABLE custom_providers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,   -- Internal name: "openrouter", "iflow", "my-relay"
  display_name    TEXT NOT NULL,           -- Display name in admin UI
  base_url        TEXT NOT NULL,           -- e.g. "https://openrouter.ai/api/v1"
  auth_type       TEXT NOT NULL DEFAULT 'bearer',  -- bearer | api_key | custom
  auth_header     TEXT NOT NULL DEFAULT 'Authorization',  -- Custom header name
  headers         TEXT,                    -- JSON: { "X-Custom": "value" }
  proxy_url       TEXT,                    -- Optional SOCKS5/HTTP proxy
  enabled         INTEGER DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_custom_providers_name ON custom_providers(name);
```

#### Example Provider Configs

```typescript
// OpenRouter
{
  name: "openrouter",
  display_name: "OpenRouter",
  base_url: "https://openrouter.ai/api/v1",
  auth_type: "bearer",
  auth_header: "Authorization",
  headers: JSON.stringify({
    "HTTP-Referer": "https://myapp.com",
    "X-Title": "MyApp"
  }),
  proxy_url: ""
}

// iFlow (Chinese relay)
{
  name: "iflow",
  display_name: "iFlow",
  base_url: "https://apis.iflow.cn/v1",
  auth_type: "bearer",
  headers: JSON.stringify({}),
  proxy_url: "socks5://proxy.example.com:1080"
}

// Custom Clash-forwarded relay
{
  name: "my-relay",
  display_name: "My Custom Relay",
  base_url: "https://my-relay.internal/v1",
  auth_type: "api_key",
  auth_header: "X-API-Key",
  headers: JSON.stringify({ "X-Team": "dev" }),
  proxy_url: "http://127.0.0.1:7890"
}
```

### 4.3 Custom Models & Aliases / 自定义模型与别名

A **Model** entry maps a client-visible model name to an upstream provider + actual model name. This enables **model aliases** — one of CLIProxyAPI's most beloved features.

#### D1 Schema: `custom_models`

```sql
CREATE TABLE custom_models (
  id              TEXT PRIMARY KEY,
  provider_id     TEXT NOT NULL,           -- FK to custom_providers.id
  model           TEXT NOT NULL,           -- Upstream model name (e.g. "moonshotai/kimi-k2:free")
  alias           TEXT NOT NULL UNIQUE,    -- Client-facing name (e.g. "kimi-k2")
  display_name    TEXT,                    -- Human-readable: "Kimi K2 (Free)"
  api_format      TEXT NOT NULL DEFAULT 'openai',  -- openai | gemini | claude | cohere
  supports_streaming INTEGER DEFAULT 1,
  supports_functions INTEGER DEFAULT 0,
  context_window  INTEGER,                  -- Max context tokens
  enabled         INTEGER DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES custom_providers(id)
);

CREATE INDEX idx_custom_models_alias ON custom_models(alias);
CREATE INDEX idx_custom_models_provider ON custom_models(provider_id);
```

#### Built-In Model Aliases (Pre-seeded)

| Alias | Upstream Provider | Actual Model |
|-------|------------------|--------------|
| `kimi-k2` | OpenRouter | `moonshotai/kimi-k2:free` |
| `glm-4.5` | iFlow | `glm-4.5` |
| `deepseek-v3.1` | iFlow | `deepseek-v3.1` |
| `gemini-pro-latest` | Gemini | `gemini-2.5-pro` |
| `claude-sonnet-latest` | Claude | `claude-3-5-sonnet-20241022` |
| `gpt-4o-mini` | OpenAI | `gpt-4o-mini` |

### 4.4 Routing Resolution Algorithm / 路由解析算法

When a request arrives with `model: "kimi-k2"`, the gateway resolves it like this:

```
1. Lookup "kimi-k2" in custom_models (by alias)
   → Found: provider=openrouter, actual_model=moonshotai/kimi-k2:free
   ✅ Route to openrouter provider

2. If alias not found, check if it matches a built-in model name
   → Gemini "gemini-2.5-pro" → Gemini provider
   → OpenAI "gpt-4o" → OpenAI provider

3. If still not found → 404 "model not found"
```

**Alias wins over real model names** — this allows overriding even built-in providers (e.g. remapping `gpt-4o` to a cheaper OpenRouter instance).

### 4.5 Format Translators / 格式转换器

Each `api_format` has a built-in translator. Translators convert OpenAI-shaped requests to the provider's native format and back.

```typescript
// Translator registry (workers/src/translators/index.ts)
type Format = 'openai' | 'gemini' | 'claude' | 'cohere';

interface Translator {
  name: Format;
  // Convert OpenAI Chat → Provider format
  toProvider(model: string, body: OpenAIBody): ProviderBody;
  // Convert Provider response → OpenAI Chat format
  toOpenAI(response: ProviderResponse, model: string): OpenAIResponse;
  // Streaming variant (SSE delta conversion)
  toOpenAIStream(chunk: ProviderSSEChunk, model: string): OpenAISSEChunk;
}
```

**Registered Translators:**

| Format | Providers | Notes |
|--------|-----------|-------|
| `openai` | OpenAI, OpenRouter, iFlow, custom relays | Native OpenAI format, minimal translation |
| `gemini` | Gemini API | Convert to `generateContent` format |
| `claude` | Claude API | Convert to `claude-3` format |
| `cohere` | Cohere | For embedding endpoints |

### 4.6 Admin API: Custom Providers & Models

All require admin session cookie.

#### Providers

```
GET /api/admin/providers
→ [{ "id", "name", "display_name", "base_url", "auth_type", "enabled", "model_count" }]

POST /api/admin/providers
Body: {
  "name": "openrouter",
  "display_name": "OpenRouter",
  "base_url": "https://openrouter.ai/api/v1",
  "auth_type": "bearer",
  "headers": { "HTTP-Referer": "https://myapp.com" },
  "proxy_url": ""
}
→ { "id", ... }

PATCH /api/admin/providers/:id
Body: partial update (any fields above)

DELETE /api/admin/providers/:id
→ { "ok": true }
Note: Fails if models still reference this provider.
```

#### Models

```
GET /api/admin/models
Query: ?provider_id=xxx
→ [{ "id", "provider_id", "model", "alias", "display_name", "api_format", "context_window", "enabled" }]

POST /api/admin/models
Body: {
  "provider_id": "openrouter-uuid",
  "model": "moonshotai/kimi-k2:free",
  "alias": "kimi-k2",
  "display_name": "Kimi K2 (Free)",
  "api_format": "openai",
  "context_window": 32768,
  "supports_streaming": true,
  "supports_functions": false
}
→ { "id", ... }

PATCH /api/admin/models/:id
Body: partial update (e.g. { "enabled": false } or { "alias": "kimi-k2-prod" })

DELETE /api/admin/models/:id
→ { "ok": true }
```

#### Import Model Presets

```
POST /api/admin/models/presets
Body: { "provider_id": "xxx", "preset": "openrouter-free" }
→ { "added": 12, "skipped": 0 }
```

**Built-in presets:**

| Preset | Description | Models |
|--------|------------|--------|
| `openrouter-free` | Popular free models on OpenRouter | kimi-k2, deepseek-v3.1, qwen2.5-72b, etc. |
| `openrouter-popular` | Popular paid models | gpt-4o, claude-3.5-sonnet, etc. |
| `iflow-free` | iFlow free tier | glm-4.5, glm-4, deepseek-v3.1 |
| `gemini-free` | Gemini CLI free models | gemini-2.5-pro, gemini-2.5-flash |

### 4.7 Per-Key Model Override / 按密钥模型覆盖

In the original CLIProxyAPI, each API key can override the default model. We extend this to also specify a **custom provider** and **embedding model**:

```typescript
// api_keys table (extended)
interface APIKey {
  id: string;
  api_key: string;           // Hashed, e.g. "sk_live_abc123"
  key_prefix: string;         // "sk_live_abc123" (first 12 chars)
  name: string;              // "Alice's kimi"
  provider: string;          // "openrouter" | "openai" | "gemini" | "custom:my-relay"
  model: string;             // Default model for this key (alias or real name)
  api_secret: string;        // Encrypted upstream API key
  embeddings_provider: string;  // Provider for /v1/embeddings ✨
  embeddings_model: string;  // Model for embeddings ✨
  excluded_models: string[]; // Blocklist for this key
  rate_limit: number;        // req/min
  enabled: boolean;
  created_at: number;
  updated_at: number;
}
```

**Key-level routing override:**

```
Request: Bearer sk_live_xxx
         model: "gpt-4o"

Key config:
  provider: "openrouter"
  model: "kimi-k2"      ← overrides client-specified model

Result: Routes to OpenRouter with model "kimi-k2" (not "gpt-4o")

This enables:
- "Load balancing keys": same key → different models per request
- "Allowlist keys": client can only use certain models
- "Model lockdown": enforce cheap model across team
```

### 4.8 Putting It All Together / 完整示例

**Scenario:** You want to offer a free `kimi-k2` model to users, backed by OpenRouter relay.

**Step 1 — Add Provider (Admin API)**

```bash
curl -X POST https://your-workers.workers.dev/api/admin/providers \
  -H "Cookie: session=admin_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openrouter",
    "display_name": "OpenRouter",
    "base_url": "https://openrouter.ai/api/v1",
    "auth_type": "bearer",
    "headers": { "HTTP-Referer": "https://yourapp.com" }
  }'
```

**Step 2 — Add Model Alias (Admin API)**

```bash
curl -X POST https://your-workers.workers.dev/api/admin/models \
  -H "Cookie: session=admin_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "<uuid-from-step1>",
    "model": "moonshotai/kimi-k2:free",
    "alias": "kimi-k2",
    "display_name": "Kimi K2 (Free)",
    "api_format": "openai",
    "context_window": 32768
  }'
```

**Step 3 — Create API Key (Admin API)**

```bash
curl -X POST https://your-workers.workers.dev/api/admin/keys \
  -H "Cookie: session=admin_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Free tier",
    "provider": "openrouter",
    "model": "kimi-k2",
    "api_secret": "sk-or-v2-xxxx",
    "rate_limit": 30
  }'
```

**Step 4 — User calls the API**

```bash
curl https://your-workers.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk_live_abc123xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kimi-k2",   # ← alias resolves to moonshotai/kimi-k2:free
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'
# → Routed to OpenRouter, returns OpenAI-compatible response
```

---

## 5. i18n System / 国际化系统

### 4.1 Language Files

```
pages/src/i18n/
├── en.json
└── zh.json
```

### 4.2 Sample Strings

| Key | English | 中文 |
|-----|---------|------|
| `nav.dashboard` | Dashboard | 控制台 |
| `nav.keys` | API Keys | API 密钥 |
| `nav.models` | Models | 模型 |
| `nav.embeddings` | Embeddings | 向量索引 |
| `nav.settings` | Settings | 设置 |
| `nav.logs` | Logs | 日志 |
| `login.title` | Admin Login | 管理员登录 |
| `login.token_placeholder` | Enter admin token | 输入管理员令牌 |
| `login.btn` | Sign In | 登录 |
| `dashboard.total_keys` | Total API Keys | API 密钥总数 |
| `dashboard.requests_today` | Requests Today | 今日请求 |
| `keys.create` | Create Key | 创建密钥 |
| `keys.provider` | Provider | 提供商 |
| `keys.model` | Model | 模型 |
| `keys.emb_model` | Embedding Model | 向量模型 |
| `keys.rate_limit` | Rate Limit (req/min) | 速率限制 (次/分) |
| `embeddings.title` | Embeddings Index | 向量索引 |
| `embeddings.search` | Search by text | 文本搜索 |
| `embeddings.store` | Store & Index | 存储并索引 |
| `settings.lang` | Language | 语言 |
| `settings.lang_en` | English | 英文 |
| `settings.lang_zh` | 中文 | Chinese |
| `error.invalid_key` | Invalid API key | 无效的 API 密钥 |
| `error.rate_limited` | Rate limit exceeded | 超出速率限制 |
| `error.upstream_error` | Upstream provider error | 上游服务商错误 |

---

## 6. Database Schema (D1) / 数据库设计

### 5.1 Full Schema

```sql
-- API Keys table
CREATE TABLE api_keys (
  id              TEXT PRIMARY KEY,
  api_key         TEXT NOT NULL UNIQUE,   -- Hashed display key
  key_prefix      TEXT NOT NULL,          -- sk_abc123 → "sk_abc123"
  name            TEXT NOT NULL,
  provider        TEXT NOT NULL,          -- openai|gemini|claude|qwen|cohere
  model           TEXT NOT NULL,
  api_secret      TEXT NOT NULL,          -- Encrypted upstream key
  embeddings_model TEXT,                  -- Optional dedicated embedding model
  rate_limit      INTEGER DEFAULT 60,
  enabled         INTEGER DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX idx_api_keys_api_key ON api_keys(api_key);

-- Embeddings storage ✨
CREATE TABLE embeddings_index (
  id          TEXT PRIMARY KEY,
  api_key_id  TEXT NOT NULL,
  text        TEXT NOT NULL,
  vector      BLOB NOT NULL,              -- Float32Array → Blob
  model       TEXT NOT NULL,
  metadata    TEXT,                       -- JSON string
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE INDEX idx_embeddings_api_key_id ON embeddings_index(api_key_id);

-- Admin sessions
CREATE TABLE admin_sessions (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Request logs (for admin UI)
CREATE TABLE request_logs (
  id          TEXT PRIMARY KEY,
  api_key_id  TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  tokens_used INTEGER,
  latency_ms  INTEGER,
  status_code INTEGER,
  error_msg   TEXT,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);
```

### 5.2 KV Namespaces

| Namespace | Purpose |
|-----------|---------|
| `api_keys` | API key → config cache (5min TTL) |
| `sessions` | Admin session tokens (24h TTL) |
| `rate_limits` | Per-key rate limit counters |

---

## 7. API Reference (Admin API) / 管理 API

All admin API calls require `Authorization: Bearer <admin_session_token>` cookie.

### 6.1 Authentication

```
POST /api/admin/login
Body: { "token": "admin_secret_token" }
Response: { "ok": true } + Set-Cookie: session=<token>

POST /api/admin/logout
Response: { "ok": true } + Clear session cookie
```

### 6.2 API Keys

```
GET /api/admin/keys
Response: { "keys": [{ "id", "name", "provider", "model", "rate_limit", "enabled", "created_at" }] }
Note: api_secret is NEVER returned (write-only)

POST /api/admin/keys
Body: { "name", "provider", "model", "api_secret", "embeddings_model?", "rate_limit?" }
Response: { "id", "api_key": "sk_live_xxxx", "name", ... }

DELETE /api/admin/keys/:id
Response: { "ok": true }

PATCH /api/admin/keys/:id
Body: { "name"?, "model"? "enabled"? "rate_limit"? }
Response: { "ok": true }
```

### 6.3 Embeddings (Admin)

```
GET /api/admin/embeddings?api_key_id=xxx&q=search_text&limit=10
Response: { "results": [{ "id", "text", "metadata", "created_at", "score" }] }

DELETE /api/admin/embeddings/:id
Response: { "ok": true }
```

### 6.4 Stats

```
GET /api/admin/stats
Response: {
  "total_keys": 42,
  "requests_today": 1337,
  "requests_by_provider": { "openai": 800, "gemini": 537 },
  "error_rate": 0.023,
  "avg_latency_ms": 234
}
```

### 6.5 Settings

```
GET /api/admin/settings
Response: { "default_rate_limit", "enabled_providers", "maintenance_mode" }

PATCH /api/admin/settings
Body: { ... }
Response: { "ok": true }
```

---

## 8. Security / 安全设计

### 7.1 API Key Security

- API keys stored as **SHA-256 hashes** in D1
- Upstream secrets encrypted with **AES-256-GCM** (key from `ENCRYPTION_KEY` CF Secret)
- API keys never logged; only `key_prefix` (first 8 chars) in logs
- Per-key rate limiting via CF KV atomic counters

### 7.2 Admin Security

- Admin token hashed with **bcrypt** (cost factor 12)
- Session tokens: 256-bit random, stored as SHA-256 hash
- All admin endpoints require valid session cookie
- Automatic session expiry after 24 hours
- Failed login attempts: block IP for 15 min after 5 failures (CF Firewall rule)

### 7.3 CF-Side Hardening

- `workers.forbid_foreign_streaming` = true
- No `eval()` in Workers runtime
- CORS: only configured allowed origins
- Workers use `FetchHandler` with explicit `WAVersion`

---

## 9. Logo Design / Logo 设计

> See `docs/LOGO.md` for full logo specification and SVG source.

**Concept:** Lightweight shrimp mascot carrying a lightning bolt (representing Cloudflare edge speed), combined with an API endpoint symbol (`</>`) and a subtle cloud shape.

**Color Palette:**
- Primary: `#FF6B35` (vibrant coral — the shrimp)
- Secondary: `#4ECDC4` (teal — cloud / edge)
- Accent: `#FFE66D` (yellow — lightning bolt)
- Dark: `#2C2C54` (deep navy — tech stability)
- Background: `#F7F7F7` (light gray)

**Logo files:**
- `pages/public/logo.svg` — primary logo (SVG, full color)
- `pages/public/logo-icon.svg` — icon-only version (32×32)
- `pages/public/logo-dark.svg` — dark background variant

---

## 10. Tech Stack Summary / 技术栈

| Layer | Technology |
|-------|------------|
| API Gateway | Cloudflare Workers (TypeScript) |
| Frontend | Cloudflare Pages + React 18 + TailwindCSS |
| Database | Cloudflare D1 (SQLite at edge) |
| Cache | Cloudflare Workers KV |
| Async Jobs | Cloudflare Queue |
| i18n | react-i18next |
| Auth | Web Crypto API (SHA-256, AES-256-GCM) |
| Deployment | Wrangler v3 + Pages SDK |
| Fonts | Inter (UI) + JetBrains Mono (code) |

---

## 11. Development Roadmap / 开发路线图

### Phase 1 — Foundation (MVP) ✅
- [x] Project scaffolding (Workers + Pages)
- [x] Basic API gateway: chat/completions proxy
- [x] API key management (D1 + KV)
- [x] Simple admin UI (Login + Dashboard + Keys CRUD)
- [x] OpenAI-compatible endpoint at `/v1/chat/completions`
- [x] Streaming response support
- [x] Basic error handling

### Phase 2 — Multi-Provider + Embeddings ✨ ✅
- [x] Provider abstraction layer
- [x] Gemini format translator
- [x] Claude format translator
- [x] **Embeddings endpoint** (`/v1/embeddings`) ✨
- [x] Embeddings storage in D1 (Float32 BLOB + cosine similarity search) ✨
- [x] Admin Embeddings browser page ✨

### Phase 3 — Admin Polish ✅
- [x] i18n (zh + en) ✨
- [x] Admin settings page
- [x] Request logs page (分页/过滤/颜色编码)
- [x] Rate limiting enforcement
- [x] Admin token management + Preset 模型批量导入

### Phase 4 — Production Hardening ✅
- [x] End-to-end encryption for API secrets (AES-256-GCM) ✅
- [x] Rate limit headers (X-RateLimit-*) ✅
- [x] Deployment CI/CD (GitHub Actions) ✅
- [ ] Auto-scaling via CF Queue (future)
- [ ] Webhook support for embeddings callbacks (future)
- [ ] Performance monitoring dashboard (CF Analytics integration) (future)

### Phase 5 — Self-Improvement & Auto-Tuning (future)
- [ ] Per-key usage analytics
- [ ] Automatic model fallback on upstream errors
- [ ] Smart routing based on latency/availability
- [ ] RAG pipeline integration (vector DB hooks)

---

## 12. Deployment / 部署

See [`docs/DEPLOY.md`](./DEPLOY.md) for detailed deployment instructions.

**Quick Setup:**

```bash
# 1. Clone and install
git clone https://github.com/<user>/cliproxyapi-lite.git
cd cliproxyapi-lite
npm install

# 2. Configure secrets
wrangler secret put ADMIN_TOKEN        # Admin login token
wrangler secret put ENCRYPTION_KEY    # AES-256 key (32 bytes, base64)
wrangler secret put ADMIN_TOKEN_BCRYPT # bcrypt hash of admin token

# 3. Create D1 database
wrangler d1 create cliproxyapi-lite-db
# Copy database_id to wrangler.toml

# 4. Run migrations
wrangler d1 execute cliproxyapi-lite-db --file=scripts/init-d1.sql

# 5. Deploy Workers
cd workers && wrangler deploy

# 6. Deploy Pages
cd ../pages && wrangler pages deploy

# 7. Set Pages environment variable
wrangler pages config set --project-name=cliproxyapi-lite
wrangler secret put WORKERS_API_URL=https://cliproxyapi-lite.<your-subdomain>.workers.dev
```

---

*Last updated: 2026-03-29 | Version 0.1.0 Draft*
