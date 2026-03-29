# CLIProxyAPI Lite — Deployment Guide

> English | [中文](./DEPLOY_ZH.md)

This guide covers deploying CLIProxyAPI Lite to Cloudflare from scratch.

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [npm](https://www.npmjs.com/) ≥ 9
- A [Cloudflare account](https://dash.cloudflare.com/) (Free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed

```bash
npm install -g wrangler
wrangler login  # Authenticate with Cloudflare
```

---

## Step 1 — Clone & Install

```bash
git clone https://github.com/<your-name>/cliproxyapi-lite.git
cd cliproxyapi-lite
npm install
```

---

## Step 2 — Create Cloudflare Resources

### 2.1 D1 Database

```bash
cd /home/projects/cliproxyapi-lite

# Create D1 database
wrangler d1 create cliproxyapi-lite-db
```

**Output example:**
```
{ binding = "D1", database_name = "cliproxyapi-lite-db", database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

Copy the `database_id` — you'll need it for `wrangler.toml`.

### 2.2 KV Namespace

```bash
# Create KV namespace
wrangler kv:namespace create cliproxyapi_kv
```

**Output example:**
```
{ binding = "KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

Copy the `id` — you'll need it for `wrangler.toml`.

### 2.3 Initialize Database Schema

```bash
wrangler d1 execute cliproxyapi-lite-db \
  --file=scripts/init-d1.sql \
  --remote   # Use --local for local dev
```

Verify tables created:
```bash
wrangler d1 info cliproxyapi-lite-db
```

---

## Step 3 — Configure `wrangler.toml`

### Workers (`workers/wrangler.toml`)

```toml
name = "cliproxyapi-lite"
main = "src/index.ts"
compatibility_date = "2024-04-15"

[vars]
WORKERS_ENV = "production"

# ⚠️ REPLACE THESE IDs
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"   # ← from Step 2.2

[[d1_databases]]
binding = "D1"
database_name = "cliproxyapi-lite-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← from Step 2.1
```

### Pages (`pages/wrangler.toml`)

```toml
name = "cliproxyapi-lite-pages"
compatibility_date = "2024-04-15"
pages_build_output_dir = "dist"
```

> **Note:** The Pages Functions proxy (`functions/api/[...slug].ts`) calls Workers at `WORKERS_API_URL`. You set this as a secret in Step 5.

---

## Step 4 — Set Secrets

Secrets **cannot** be put in `wrangler.toml` — use `wrangler secret put`.

### Workers secrets

```bash
cd /home/projects/cliproxyapi-lite/workers

# Admin login token (change this to a strong random string)
wrangler secret put ADMIN_TOKEN
# Enter your secret token when prompted, e.g.: MySecureAdminToken2026!

# Optional: AES-256 encryption key for API secrets (32 bytes, base64)
# Generate with: openssl rand -base64 32
wrangler secret put ENCRYPTION_KEY
# Enter a 44-character base64 string
```

### Pages secrets

```bash
cd /home/projects/cliproxyapi-lite/pages

# Workers API URL (where your Workers is deployed)
wrangler secret put WORKERS_API_URL
# Enter your Workers URL, e.g.: https://cliproxyapi-lite.your-subdomain.workers.dev
```

---

## Step 5 — Deploy

### 5.1 Deploy Workers

```bash
cd /home/projects/cliproxyapi-lite/workers
wrangler deploy
```

**Save the Workers URL** — you'll need it for Pages in Step 5.2.

Example output:
```
https://cliproxyapi-lite.xxxxx.workers.dev
```

### 5.2 Update Pages secret with the real URL

```bash
cd /home/projects/cliproxyapi-lite/pages

# If you didn't set WORKERS_API_URL in Step 4 yet:
wrangler secret put WORKERS_API_URL
# Enter: https://cliproxyapi-lite.xxxxx.workers.dev
```

### 5.3 Build & Deploy Pages

```bash
cd /home/projects/cliproxyapi-lite/pages

# Build the React app
npm install
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist
```

Or combine both:
```bash
npm run deploy  # runs build && wrangler pages deploy
```

---

## Step 6 — Configure Custom Domain (Optional)

### Workers custom domain

```bash
cd /home/projects/cliproxyapi-lite/workers
wrangler routes add --domain ai-api.yourdomain.com
```

### Pages custom domain

```bash
cd /home/projects/cliproxyapi-lite/pages
wrangler pages domain add ai-api.yourdomain.com
```

> Note: You can use **different subdomains** for Workers and Pages:
> - Workers: `https://api.yourdomain.com`
> - Pages: `https://admin.yourdomain.com`
> Just update `WORKERS_API_URL` in Pages secrets to match.

---

## Step 7 — Verify Deployment

### Health check
```bash
curl https://cliproxyapi-lite.xxxxx.workers.dev/health
# Expected: {"status":"ok","timestamp":1749999999}
```

### List models
```bash
curl https://cliproxyapi-lite.xxxxx.workers.dev/v1/models \
  -H "Authorization: Bearer sk_live_your_key"
```

### Admin login
```bash
curl -X POST https://cliproxyapi-lite.xxxxx.workers.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"token":"MySecureAdminToken2026!"}'
# Expected: {"ok":true,"token":"<session-token>"}
```

### Admin dashboard
Open `https://cliproxyapi-lite-pages.pages.dev/` (or your custom domain).

---

## Environment Reference

### Workers Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_TOKEN` | ✅ | Plaintext admin login token |
| `ENCRYPTION_KEY` | Optional | AES-256 key (base64) for encrypting API secrets |
| `KV` | ✅ (bound) | KV namespace for sessions, rate limits, API key cache |
| `D1` | ✅ (bound) | D1 database for keys, providers, models, embeddings |

### Pages Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKERS_API_URL` | ✅ | Full URL of the deployed Workers, e.g. `https://cliproxyapi-lite.xxxxx.workers.dev` |

---

## Local Development

### Start Workers locally

```bash
cd /home/projects/cliproxyapi-lite/workers
wrangler dev
# Workers runs at http://localhost:8787
```

### Start Pages locally

```bash
cd /home/projects/cliproxyapi-lite/pages
# Set WORKERS_API_URL to your local workers
export WORKERS_API_URL=http://localhost:8787
npm run dev
# Pages runs at http://localhost:5173
```

### Local D1/KV (no real Cloudflare resources)

For local dev without creating real resources, use `wrangler dev --local`:

```bash
# Workers
cd workers
wrangler dev --local   # Uses local in-memory storage

# D1 migrations
wrangler d1 execute cliproxyapi-lite-db --local --file=scripts/init-d1.sql
```

### `.dev.vars` file (local secrets)

Create `workers/.dev.vars` (not committed to git):

```
ADMIN_TOKEN=MyLocalDevToken
ENCRYPTION_KEY=your-32-byte-base64-key-here==
```

---

## Upgrading

```bash
cd /home/projects/cliproxyapi-lite

# Pull latest changes
git pull

# Redeploy Workers
cd workers && wrangler deploy

# Redeploy Pages
cd ../pages && npm run build && wrangler pages deploy dist
```

---

## Troubleshooting

### "D1 client err: ..."

Your D1 `database_id` in `wrangler.toml` is wrong, or you haven't run migrations.
```bash
wrangler d1 execute cliproxyapi-lite-db --file=scripts/init-d1.sql --remote
```

### "KV namespace not found"

The KV `id` in `wrangler.toml` doesn't match the namespace you created.
```bash
wrangler kv:namespace list  # Check existing namespaces
```

### "Admin login not working"

1. Check `ADMIN_TOKEN` secret is set correctly in Workers:
```bash
wrangler secret list --env production
```

2. Verify the token matches exactly (no extra spaces/newlines).

### "Pages can't reach Workers"

1. Verify `WORKERS_API_URL` is set in Pages secrets:
```bash
wrangler secret list --env production --project=cliproxyapi-lite-pages
```

2. Check the URL has no trailing slash and is accessible:
```bash
curl https://your-workers.workers.dev/health
```

### "CORS errors in browser"

Make sure the `WORKERS_API_URL` in Pages matches exactly where Workers is deployed. If Workers has CORS restrictions, update the `cors()` config in `workers/src/index.ts`.

---

## Architecture Summary

```
                    ┌─────────────────────────────────┐
                    │         Cloudflare              │
                    │                                 │
  Browser ──────────►│  Pages (React Admin UI)        │
                    │   functions/api/[...slug] ──────┼──► Workers Admin API
                    │                                 │
                    │  Workers (API Gateway)          │
                    │   ├─ /v1/chat/completions       │
                    │   ├─ /v1/embeddings             │
                    │   └─ /v1/models                 │
                    │                                 │
                    │  D1 (SQLite)                   │
                    │   ├─ api_keys                  │
                    │   ├─ custom_providers          │
                    │   ├─ custom_models             │
                    │   ├─ embeddings_index          │
                    │   └─ request_logs              │
                    │                                 │
                    │  KV                            │
                    │   ├─ API key cache             │
                    │   ├─ Admin sessions            │
                    │   └─ Rate limit counters       │
                    └─────────────────────────────────┘
```

---

*Last updated: 2026-03-29 | Version 0.1.0*
