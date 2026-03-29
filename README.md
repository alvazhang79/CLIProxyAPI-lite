# CLIProxyAPI Lite

> **"Lightweight AI Gateway, Powered by Edge"**
> 轻量 AI 网关，边缘驱动

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

**English** | [中文](./README_ZH.md)

---

A lightweight, edge-native AI API gateway built on Cloudflare Workers and Pages. One OpenAI-compatible endpoint, multiple upstream AI providers. Supports **chat/completion**, **embeddings**, per-key LLM routing, and a bilingual admin dashboard.

**Based on [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). Adds native CF Workers/Pages support and embeddings.**

---

## ✨ Features

- 🌐 **OpenAI-Compatible API** — Drop-in replacement for OpenAI SDKs and tools
- 🤖 **Multi-Provider Routing** — OpenAI · Gemini · Claude · Qwen · Cohere (extensible)
- 📊 **Embeddings Support** — `/v1/embeddings` endpoint with local vector storage ✨
- 🔗 **Custom Providers & Model Aliases** — Add any OpenAI-compatible relay (OpenRouter, iFlow, custom Clash nodes), define model aliases (e.g. `kimi-k2` → `moonshotai/kimi-k2:free`) via admin API without code changes ✨
- 🔑 **Per-Key LLM Binding** — Each API key maps to a specific provider + model
- 🚀 **Edge-Native** — Deployed on 300+ Cloudflare PoPs worldwide, sub-10ms cold start
- 📈 **Admin Dashboard** — Bilingual (EN/ZH) web UI, token auth, no user accounts needed
- 🔒 **Secure by Design** — AES-256-GCM secrets, bcrypt admin auth, per-key rate limiting
- 💾 **D1 + KV** — SQLite at the edge for config, Workers KV for hot cache

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/<your-name>/cliproxyapi-lite.git
cd cliproxyapi-lite

# 2. Install dependencies
npm install

# 3. Configure secrets
wrangler secret put ADMIN_TOKEN        # Your admin login token
wrangler secret put ENCRYPTION_KEY    # 32-byte key, base64 encoded

# 4. Create & migrate D1 database
wrangler d1 create cliproxyapi-lite-db
# Copy database_id to workers/wrangler.toml and pages/wrangler.toml
wrangler d1 execute cliproxyapi-lite-db --file=scripts/init-d1.sql

# 5. Deploy Workers
cd workers && wrangler deploy

# 6. Deploy Pages
cd ../pages && wrangler pages deploy

# 7. Set Pages env vars
wrangler secret put WORKERS_API_URL=https://your-workers-subdomain.workers.dev
```

---

## Usage

### Get your API Key

```bash
# In the Admin Dashboard (http://your-pages-site/admin)
# Create an API key bound to your provider + model
```

### Use with OpenAI SDK

```python
import openai

client = openai.OpenAI(
    api_key="sk_live_xxxxxxxxxxxx",      # Your CLIProxyAPI Lite key
    base_url="https://your-workers.workers.dev"  # Your Workers URL
)

# Chat completion
chat = client.chat.completions.create(
    model="gemini-2.5-pro",              # Model name (per-key configured)
    messages=[{"role": "user", "content": "Hello!"}]
)
print(chat.choices[0].message.content)

# Embeddings ✨
emb = client.embeddings.create(
    model="text-embedding-3-small",       # Or your configured embedding model
    input="Hello world"
)
print(emb.data[0].embedding)
```

### Use with cURL

```bash
curl https://your-workers.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [{"role": "user", "content": "Hi"}],
    "stream": false
  }'
```

---

## Architecture

```
Client (OpenAI SDK / cURL)
         │
         ▼
Cloudflare Workers (Edge)
  ├─ API Key Auth (KV cache)
  ├─ Format Translator
  └─ Provider Router
         │
  ┌──────┼──────────────────┐
  ▼      ▼                  ▼
OpenAI  Gemini CLI         Claude Code
API      OAuth              OAuth
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | Chat completion |
| `POST /v1/completions` | Text completion |
| `POST /v1/messages` | Anthropic messages API |
| **`POST /v1/embeddings`** | Text embeddings ✨ |
| `GET /v1/models` | List models |
| `GET /health` | Health check |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| API Gateway | Cloudflare Workers (TypeScript) |
| Frontend | Cloudflare Pages + React + TailwindCSS |
| Database | Cloudflare D1 (SQLite at edge) |
| Cache | Cloudflare Workers KV |
| i18n | react-i18next (EN + ZH) |

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Logo

![logo](./pages/public/logo.svg)

Mascot: 🦐 (shrimp) + ⚡ (lightning) + ☁️ (cloud) — the essence of "Lite, Fast, Edge".
