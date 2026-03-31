# CLIProxyAPI Lite

轻量级 API 代理平台，支持多 Provider（OpenAI/Gemini/Claude/NVIDIA 等），带管理后台和 AES-256-GCM 密钥加密。

## 特性

- 🚀 **多 Provider 支持**: OpenAI、Gemini、Claude、NVIDIA、Groq、硅基流动等
- 🔐 **密钥加密**: AES-256-GCM 加密存储上游 API Key
- 📊 **管理后台**: React + TailwindCSS 构建的现代化管理界面
- ⚡ **Cloudflare Workers**: 全球边缘部署，低延迟
- 💾 **D1 数据库**: SQLite 存储配置和日志
- 🔄 **流式响应**: 完整支持 SSE 流式输出

## 快速部署

### 前置要求

1. [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
2. Node.js 18+
3. Git

### 步骤 1: Fork 或 Clone

```bash
git clone https://github.com/YOUR_USERNAME/CLIProxyAPI-lite.git
cd CLIProxyAPI-lite
npm install
```

### 步骤 2: 创建 Cloudflare 资源

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 获取你的 **Account ID**（在右侧栏）
3. 创建 **API Token**：
   - 进入 [My Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - 点击「Create Token」
   - 选择「Edit Cloudflare Workers」模板
   - **重要**: 添加以下权限：
     - `Account > Workers Scripts > Edit`
     - `Account > Workers KV Storage > Edit`
     - `Account > D1 > Edit`
   - 点击「Continue to summary」→「Create Token」
   - 复制生成的 Token

### 步骤 3: 配置 GitHub Secrets

在你的 GitHub 仓库中，进入 Settings > Secrets and variables > Actions，添加：

| Secret 名称 | 值 |
|------------|---|
| `CLOUDFLARE_API_TOKEN` | 上一步获取的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Cloudflare Account ID |

### 步骤 4: 推送触发部署

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

GitHub Actions 会自动完成部署。

### 步骤 5: 设置管理员密码

部署完成后，需要设置管理员密码：

```bash
# 安装 wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 设置管理员密码
cd workers
wrangler secret put ADMIN_TOKEN --env production
# 输入你的密码（至少 8 个字符）
```

### 步骤 6: 访问管理后台

部署成功后，GitHub Actions 日志会显示 Workers URL。

## 使用方法

### 1. 登录管理后台

使用你设置的 `ADMIN_TOKEN` 登录。

### 2. 添加 Provider

在「Providers」页面添加上游 API：

| 字段 | 示例值 |
|------|--------|
| Name | `nvidia` |
| Display Name | `NVIDIA NIM` |
| Base URL | `https://integrate.api.nvidia.com/v1` |
| Auth Type | `Bearer Token` |

### 3. 添加模型

在「Models」页面点击「从 Provider 获取模型列表」自动导入。

### 4. 创建 API Key

在「API Keys」页面创建代理 Key，系统会生成 `sk_live_xxx` 格式的密钥。

### 5. 调用 API

```bash
curl https://YOUR-WORKERS-URL/v1/chat/completions \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/llama-3.1-nemotron-70b-instruct",
    "messages": [{"role": "user", "content": "你好！"}]
  }'
```

## Embedding 模型使用

```bash
curl https://YOUR-WORKERS-URL/v1/embeddings \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/llama-3.2-nemoretriever-300m-embed-v1",
    "input": "你好世界",
    "input_type": "query"
  }'
```

## 故障排除

### 部署失败

1. 检查 GitHub Secrets 是否正确设置
2. 确认 API Token 有 D1 Edit 权限
3. 查看 GitHub Actions 日志

### 登录失败

```bash
cd workers
wrangler secret put ADMIN_TOKEN --env production
```

## License

MIT
