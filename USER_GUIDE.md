# CLIProxyAPI Lite 使用指南

## 管理后台地址
👉 https://94cc37e2.cliproxyapi-lite-4yc.pages.dev
👉 https://94cc37e2.cliproxyapi-lite-4yc.pages.dev/admin

**登录密码**: `SfZwmRSYGse894Ab`

---

## 功能模块

### 1. API Keys（密钥管理）
**路径**: 侧边栏「API Keys」

用于创建、查看、重新生成对外分发的 API Key。

#### 创建新 Key
1. 点击右上角「Create」
2. 填写表单：
   - **Key 名称**: 给这个 Key 起个名字，如「用户A的Key」
   - **提供商**: 选择 OpenAI / Gemini / Claude 等
   - **模型**: 具体模型名，如 `gpt-4o-mini`、`gemini-2.0-flash`
   - **上游 API Key**: 你从 OpenAI/Gemini 等获取的原始 API Key
   - **限速**: 每分钟最大请求数
3. 点击「Create」后，系统会**自动生成一个代理 Key**，格式如 `sk_live_AbCdEfGh...`
4. **⚠️ 重要**: 代理 Key 只显示一次！请立即复制保存

#### 重新生成 Key
如果 Key 泄露，可以点击「重新生成」按钮，旧 Key 会立即失效。

#### 启用/禁用
点击「禁用」可临时封停某个 Key，点击「启用」可恢复。

---

### 2. Providers（自定义 API 来源）
**路径**: 侧边栏「Providers」

添加自定义的 API 来源，如第三方代理服务。

#### 添加 Provider
1. 点击「Add Provider」
2. 填写表单：
   - **名称**: 内部标识名，如 `openrouter`
   - **显示名称**: 如 `OpenRouter`
   - **Base URL**: API 地址，如 `https://openrouter.ai/api/v1`
3. 点击「⚙️ 高级选项」展开更多配置：
   - **认证方式**: 
     - `Bearer Token` - Authorization: Bearer xxx
     - `API Key (X-API-Key)` - X-API-Key: xxx
     - `Custom Header` - 自定义 header 名称
   - **自定义请求头**: JSON 格式，如 `{"X-Custom-Header": "value"}`
   - **代理地址**: HTTP 代理，如 `http://proxy:8080`

#### 使用场景
- 接入 OpenRouter（各种模型聚合）
- 接入第三方 AI 代理服务
- 使用自己的代理服务器

---

### 3. Models（模型别名管理）
**路径**: 侧边栏「Models」

给模型创建别名，方便管理和路由。

#### 快速导入预设模型
1. 点击右上角「📥 导入预设模型」
2. 选择提供商（openai / gemini / claude / openrouter）
3. 预设模型会批量导入

#### 手动添加模型
1. 点击「Add Model」
2. 填写表单：
   - **Provider**: 选择已有的 Provider
   - **上游模型**: 如 `gpt-4o-mini`
   - **别名**: 如 `my-gpt4`
3. 点击「⚙️ 高级选项」：
   - **API 格式**: OpenAI / Gemini / Claude / Cohere
   - **上下文窗口**: token 数量
   - **流式输出**: 是否支持 streaming
   - **函数调用**: 是否支持 function calling

#### 使用场景
- 将 `openrouter/anthropic/claude-3.5-sonnet` 简化为 `claude-35`
- 为不同 Provider 的同一模型创建统一别名

---

### 4. Settings（系统设置）
**路径**: 侧边栏「Settings」

- **界面语言**: 中文 / English
- **默认限速**: 新建 Key 的默认限速值
- **修改登录密码**: 修改管理员密码

---

## 使用流程示例

### 方式一：直接使用（推荐）

1. 在「API Keys」页面创建 Key，填入你的 OpenAI API Key
2. 系统生成代理 Key，如 `sk_live_AbCdEfGh123456`
3. 将代理 Key 提供给用户

**用户调用方式**:
```bash
curl https://cliproxyapi-lite-production.no9527.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk_live_AbCdEfGh123456" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}]}'
```

### 方式二：通过自定义 Provider + Model

1. 在「Providers」添加 OpenRouter
2. 在「Models」创建别名，如 `claude-35` → `anthropic/claude-3.5-sonnet`
3. 用户使用时指定别名：
```bash
curl https://cliproxyapi-lite-production.no9527.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer sk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-35", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## 常见问题

**Q: Key 显示「ON」但调用失败？**
A: 检查日志页面（Logs）查看具体错误信息，可能是限速触发或上游 API Key 无效。

**Q: 重新生成 Key 后旧 Key 还能用吗？**
A: 不能。重新生成后旧 Key 立即失效。

**Q: Provider 和 API Key 的区别？**
A: Provider 定义了如何调用上游 API（URL、认证方式、代理），API Key 则存储具体的密钥并与模型绑定。

---

## 技术架构

- **Workers API**: `https://cliproxyapi-lite-production.no9527.workers.dev`
- **前端**: Cloudflare Pages
- **数据存储**: Cloudflare D1 (SQLite) + KV (Session)
- **密钥加密**: AES-256-GCM
