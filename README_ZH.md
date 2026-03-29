# CLIProxyAPI Lite

> **"轻量 AI 网关，边缘驱动"**
> English | **中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

轻量、边缘化的 AI API 网关，基于 Cloudflare Workers 和 Pages 构建。一个 OpenAI 兼容端点，对接多个上游 AI 提供商。支持 **chat/completion**、**embeddings**、按密钥路由模型、中英双语管理后台。

**基于 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 开发，新增 CF Workers/Pages 原生支持和 embeddings 功能。**

---

## ✨ 功能亮点

- 🌐 **OpenAI 兼容 API** — 无缝替换 OpenAI SDK 和工具
- 🤖 **多提供商路由** — OpenAI · Gemini · Claude · Qwen · Cohere（可扩展）
- 📊 **Embeddings 支持** — `/v1/embeddings` 端点 + 本地向量存储 ✨
- 🔗 **自定义提供商 & 模型别名** — 通过管理 API 动态添加任意 OpenAI 兼容转发商（OpenRouter、iFlow、自定义 Clash 节点），定义模型别名（如 `kimi-k2` → `moonshotai/kimi-k2:free`），无需改代码 ✨
- 🔑 **按密钥绑定模型** — 每个 API 密钥对应特定提供商 + 模型组合
- 🚀 **边缘原生** — 部署在 300+ 个 Cloudflare PoP 节点，冷启动 <10ms
- 📈 **管理后台** — 中英双语，Token 认证，无需多用户账号
- 🔒 **安全设计** — AES-256-GCM 加密、bcrypt 后台认证、按密钥限速
- 💾 **D1 + KV** — 边缘 SQLite 配置存储 + Workers KV 热缓存

---

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/<your-name>/cliproxyapi-lite.git
cd cliproxyapi-lite

# 2. 安装依赖
npm install

# 3. 配置密钥
wrangler secret put ADMIN_TOKEN        # 你的管理后台登录令牌
wrangler secret put ENCRYPTION_KEY    # 32字节密钥，base64编码

# 4. 创建并迁移 D1 数据库
wrangler d1 create cliproxyapi-lite-db
# 将 database_id 填入 workers/wrangler.toml 和 pages/wrangler.toml
wrangler d1 execute cliproxyapi-lite-db --file=scripts/init-d1.sql

# 5. 部署 Workers
cd workers && wrangler deploy

# 6. 部署 Pages
cd ../pages && wrangler pages deploy

# 7. 设置 Pages 环境变量
wrangler secret put WORKERS_API_URL=https://your-workers-subdomain.workers.dev
```

---

## 使用方法

### 获取 API 密钥

```bash
# 访问管理后台 (http://your-pages-site/admin)
# 创建绑定到指定提供商 + 模型的 API 密钥
```

### OpenAI SDK 调用

```python
import openai

client = openai.OpenAI(
    api_key="sk_live_xxxxxxxxxxxx",      # 你的 CLIProxyAPI Lite 密钥
    base_url="https://your-workers.workers.dev"  # 你的 Workers URL
)

# 对话补全
chat = client.chat.completions.create(
    model="gemini-2.5-pro",              # 模型名称（按密钥配置）
    messages=[{"role": "user", "content": "你好！"}]
)
print(chat.choices[0].message.content)

# 向量嵌入 ✨
emb = client.embeddings.create(
    model="text-embedding-3-small",       # 或你配置的向量模型
    input="你好世界"
)
print(emb.data[0].embedding)
```

### cURL 调用

```bash
curl https://your-workers.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

---

## 架构图

```
客户端 (OpenAI SDK / cURL)
         │
         ▼
Cloudflare Workers (边缘节点)
  ├─ API 密钥验证 (KV 缓存)
  ├─ 格式转换器
  └─ 提供商路由器
         │
  ┌──────┼──────────────────┐
  ▼      ▼                  ▼
OpenAI  Gemini CLI         Claude Code
API      OAuth              OAuth
```

---

## API 端点

| 端点 | 说明 |
|------|------|
| `POST /v1/chat/completions` | 对话补全 |
| `POST /v1/completions` | 文本补全 |
| `POST /v1/messages` | Anthropic 消息 API |
| **`POST /v1/embeddings`** | 文本向量嵌入 ✨ |
| `GET /v1/models` | 模型列表 |
| `GET /health` | 健康检查 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| API 网关 | Cloudflare Workers (TypeScript) |
| 前端 | Cloudflare Pages + React + TailwindCSS |
| 数据库 | Cloudflare D1 (边缘 SQLite) |
| 缓存 | Cloudflare Workers KV |
| 国际化 | react-i18next (EN + ZH) |

---

## 项目结构

```
cliproxyapi-lite/
├── workers/              # Cloudflare Workers (API 网关)
│   ├── src/
│   │   ├── handlers/     # 各端点处理器
│   │   ├── translators/   # 格式转换 (OpenAI↔Gemini↔Claude)
│   │   ├── providers/     # 上游提供商连接器
│   │   ├── db/           # D1 + KV 工具
│   │   └── i18n/         # 国际化
│   └── wrangler.toml
├── pages/                # Cloudflare Pages (管理后台)
│   ├── src/
│   │   ├── pages/        # React 页面
│   │   ├── components/   # UI 组件
│   │   ├── hooks/        # React hooks
│   │   └── i18n/         # 语言文件
│   └── public/
│       └── logo.svg      # Logo
├── scripts/
│   └── init-d1.sql       # D1 数据库初始化 SQL
├── docs/
│   ├── DEPLOY.md         # 部署文档
│   └── LOGO.md           # Logo 设计规范
└── README.md
```

---

## License

MIT — 详见 [LICENSE](./LICENSE)。

---

## Logo

![logo](./pages/public/logo.svg)

吉祥物：🦐（虾）+ ⚡（闪电）+ ☁️（云）= "轻量、快速、边缘化"。
