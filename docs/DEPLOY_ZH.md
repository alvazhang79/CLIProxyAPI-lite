# CLIProxyAPI Lite — 部署指南

> [English](./DEPLOY.md) | 中文

从零开始将 CLIProxyAPI Lite 部署到 Cloudflare 的完整指南。

---

## 前提条件

- [Node.js](https://nodejs.org/) ≥ 18
- [npm](https://www.npmjs.com/) ≥ 9
- 一个 [Cloudflare 账号](https://dash.cloudflare.com/)（免费版即可）
- 已安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

```bash
npm install -g wrangler
wrangler login  # 认证 Cloudflare 账号
```

---

## 步骤 1 — 克隆 & 安装依赖

```bash
git clone https://github.com/<your-name>/cliproxyapi-lite.git
cd cliproxyapi-lite
npm install
```

---

## 步骤 2 — 创建 Cloudflare 资源

### 2.1 创建 D1 数据库

```bash
cd /home/projects/cliproxyapi-lite

wrangler d1 create cliproxyapi-lite-db
```

**输出示例：**
```
{ binding = "D1", database_name = "cliproxyapi-lite-db", database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

复制 `database_id`，填入 `wrangler.toml`。

### 2.2 创建 KV 命名空间

```bash
wrangler kv:namespace create cliproxyapi_kv
```

**输出示例：**
```
{ binding = "KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

复制 `id`，填入 `wrangler.toml`。

### 2.3 初始化数据库

```bash
wrangler d1 execute cliproxyapi-lite-db \
  --file=scripts/init-d1.sql \
  --remote   # 本地开发换 --local
```

验证表是否创建成功：
```bash
wrangler d1 info cliproxyapi-lite-db
```

---

## 步骤 3 — 配置 `wrangler.toml`

### Workers 配置（`workers/wrangler.toml`）

```toml
name = "cliproxyapi-lite"
main = "src/index.ts"
compatibility_date = "2024-04-15"

[vars]
WORKERS_ENV = "production"

# ⚠️ 填入步骤 2 中复制的 ID
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"   # ← 来自步骤 2.2

[[d1_databases]]
binding = "D1"
database_name = "cliproxyapi-lite-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← 来自步骤 2.1
```

### Pages 配置（`pages/wrangler.toml`）

```toml
name = "cliproxyapi-lite-pages"
compatibility_date = "2024-04-15"
pages_build_output_dir = "dist"
```

> **注意：** Pages Functions 代理（`functions/api/[...slug].ts`）通过 `WORKERS_API_URL` 调用 Workers。该 URL 在步骤 5 中设置为 secret。

---

## 步骤 4 — 设置密钥（Secrets）

Secrets **不能**写在 `wrangler.toml` 里，必须用 `wrangler secret put`。

### Workers 密钥

```bash
cd /home/projects/cliproxyapi-lite/workers

# 管理后台登录令牌（改成强随机字符串）
wrangler secret put ADMIN_TOKEN
# 提示时输入你的令牌，例如：MySecureAdminToken2026!

# 可选：AES-256 加密密钥（32 字节，base64）
# 生成方式：openssl rand -base64 32
wrangler secret put ENCRYPTION_KEY
```

### Pages 密钥

```bash
cd /home/projects/cliproxyapi-lite/pages

# Workers API 的 URL
wrangler secret put WORKERS_API_URL
# 输入你的 Workers URL，例如：https://cliproxyapi-lite.your-subdomain.workers.dev
```

---

## 步骤 5 — 部署

### 5.1 部署 Workers

```bash
cd /home/projects/cliproxyapi-lite/workers
wrangler deploy
```

**保存 Workers URL**，Pages 需要用到。

示例输出：
```
https://cliproxyapi-lite.xxxxx.workers.dev
```

### 5.2 用真实 URL 更新 Pages secret

```bash
cd /home/projects/cliproxyapi-lite/pages

wrangler secret put WORKERS_API_URL
# 输入：https://cliproxyapi-lite.xxxxx.workers.dev
```

### 5.3 构建 & 部署 Pages

```bash
cd /home/projects/cliproxyapi-lite/pages

npm install
npm run build
wrangler pages deploy dist
```

或一键执行：
```bash
npm run deploy  # build + wrangler pages deploy
```

---

## 步骤 6 — 配置自定义域名（可选）

### Workers 自定义域名

```bash
cd /home/projects/cliproxyapi-lite/workers
wrangler routes add --domain api.yourdomain.com
```

### Pages 自定义域名

```bash
cd /home/projects/cliproxyapi-lite/pages
wrangler pages domain add admin.yourdomain.com
```

> 注意：Workers 和 Pages 可以用**不同子域名**：
> - Workers：`https://api.yourdomain.com`
> - Pages：`https://admin.yourdomain.com`
> 只需把 Pages 的 `WORKERS_API_URL` secret 改为对应的 Workers URL 即可。

---

## 步骤 7 — 验证部署

### 健康检查
```bash
curl https://cliproxyapi-lite.xxxxx.workers.dev/health
# 预期：{"status":"ok","timestamp":1749999999}
```

### 模型列表
```bash
curl https://cliproxyapi-lite.xxxxx.workers.dev/v1/models
```

### 管理后台登录
```bash
curl -X POST https://cliproxyapi-lite.xxxxx.workers.dev/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"token":"MySecureAdminToken2026!"}'
# 预期：{"ok":true,"token":"<session-token>"}
```

### 打开管理后台
访问 `https://cliproxyapi-lite-pages.pages.dev/`（或你的自定义域名）。

---

## 环境变量参考

### Workers 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `ADMIN_TOKEN` | ✅ | 管理后台登录令牌（明文） |
| `ENCRYPTION_KEY` | 可选 | AES-256 密钥（base64），用于加密 API secrets |
| `KV` | ✅ (binding) | KV 命名空间：会话、限速、API Key 缓存 |
| `D1` | ✅ (binding) | D1 数据库：密钥、提供商、模型、向量、日志 |

### Pages 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `WORKERS_API_URL` | ✅ | Workers 完整 URL，例如 `https://cliproxyapi-lite.xxxxx.workers.dev` |

---

## 本地开发

### 启动 Workers（本地）

```bash
cd /home/projects/cliproxyapi-lite/workers
wrangler dev
# Workers 运行在 http://localhost:8787
```

### 启动 Pages（本地）

```bash
cd /home/projects/cliproxyapi-lite/pages
export WORKERS_API_URL=http://localhost:8787
npm run dev
# Pages 运行在 http://localhost:5173
```

### 本地 D1/KV（无需真实 Cloudflare 资源）

```bash
# Workers（本地内存模式）
cd workers
wrangler dev --local

# D1 迁移（本地）
wrangler d1 execute cliproxyapi-lite-db --local --file=scripts/init-d1.sql
```

### `.dev.vars` 文件（本地密钥）

在 `workers/.dev.vars` 中写入（不要提交到 git）：

```
ADMIN_TOKEN=MyLocalDevToken
ENCRYPTION_KEY=your-32-byte-base64-key-here==
```

---

## 升级

```bash
cd /home/projects/cliproxyapi-lite
git pull

# 重部署 Workers
cd workers && wrangler deploy

# 重部署 Pages
cd ../pages && npm run build && wrangler pages deploy dist
```

---

## 故障排查

### "D1 client err: ..."

D1 的 `database_id` 填写错误，或未执行迁移。
```bash
wrangler d1 execute cliproxyapi-lite-db --file=scripts/init-d1.sql --remote
```

### "KV namespace not found"

KV 的 `id` 与创建的命名空间不匹配。
```bash
wrangler kv:namespace list  # 查看已创建的命名空间
```

### "Admin 登录失败"

1. 确认 Workers 的 `ADMIN_TOKEN` secret 设置正确：
```bash
wrangler secret list --env production
```

2. 确认令牌完全一致（无多余空格或换行）。

### "Pages 无法访问 Workers"

1. 确认 Pages 的 `WORKERS_API_URL` secret 填写正确：
```bash
wrangler secret list --env production --project=cliproxyapi-lite-pages
```

2. 确认 URL 无尾部斜杠且可访问：
```bash
curl https://your-workers.workers.dev/health
```

---

## 架构简图

```
                    ┌─────────────────────────────────┐
                    │         Cloudflare              │
                    │                                 │
  浏览器 ──────────►│  Pages (React 管理后台)          │
                    │   functions/api/[...slug] ──────┼──► Workers Admin API
                    │                                 │
                    │  Workers (API 网关)              │
                    │   ├─ /v1/chat/completions       │
                    │   ├─ /v1/embeddings             │
                    │   └─ /v1/models                 │
                    │                                 │
                    │  D1 (SQLite)                   │
                    │   ├─ api_keys                  │
                    │   ├─ custom_providers           │
                    │   ├─ custom_models              │
                    │   ├─ embeddings_index          │
                    │   └─ request_logs              │
                    │                                 │
                    │  KV                            │
                    │   ├─ API key 缓存              │
                    │   ├─ 管理会话                  │
                    │   └─ 限速计数器                │
                    └─────────────────────────────────┘
```

---

*最后更新：2026-03-29 | Version 0.1.0*
