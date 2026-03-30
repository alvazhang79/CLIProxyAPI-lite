# CLIProxyAPI Lite 测试手册

> 最后更新：2026-03-30  
> 维护者：皮皮虾 🦐

---

## 🚀 快速开始

### 部署地址
| 环境 | URL | 状态 |
|------|-----|------|
| 管理后台 | https://5c1bcbf5.cliproxyapi-lite-4yc.pages.dev | ✅ |
| Workers API | https://cliproxyapi-lite-production.no9527.workers.dev | ✅ |

### 第一步：登录
1. 打开管理后台 URL
2. 输入管理员 Token：`SfZwmRSYGse894Ab`
3. 点击 **Sign In**

---

## 🐛 已修复的 Bug（必须验证）

### Bug 1: API 405 错误
| 项目 | 说明 |
|------|------|
| **问题** | 前端请求发到 `pages.dev/api` 而不是 `workers.dev/api`，返回 405 |
| **根因** | `pages/src/lib/api.ts` 中 WORKERS_URL 配置错误 |
| **修复版本** | `05bb2cd` |
| **验证方法** | 打开 DevTools Network，检查请求是否发到 `cliproxyapi-lite-production.no9527.workers.dev` |

### Bug 2: 创建密钥 500 错误
| 项目 | 说明 |
|------|------|
| **问题** | 创建 API Key 返回 HTTP 500 |
| **根因** | `workers/src/db/d1.ts` INSERT 语句 VALUES 占位符只有 14 个，实际需要 15 个 |
| **修复版本** | `dab8eb9` |
| **验证方法** | 执行下方测试用例 TC-003 |

### Bug 3: D1 迁移隐藏错误
| 项目 | 说明 |
|------|------|
| **问题** | CI 中 `2>/dev/null` 隐藏了迁移失败信息 |
| **修复版本** | `56675d1` |
| **验证方法** | 检查 CI 日志中是否有 PRAGMA table_info 输出 |

---

## ✅ 功能测试用例（执行清单）

### TC-001: 管理员登录
```
前置条件: 打开 https://5c1bcbf5.cliproxyapi-lite-4yc.pages.dev
步骤:
  1. 输入 Token: SfZwmRSYGse894Ab
  2. 点击 Sign In
预期: 跳转到 Dashboard，显示统计图表
结果: ☐ PASS  ☐ FAIL
备注: 
```

### TC-002: Dashboard 统计显示
```
前置条件: 已登录
步骤:
  1. 查看页面是否显示 "Requests by Provider" 图表
  2. 检查是否有数据加载
预期: 显示图表，无报错
结果: ☐ PASS  ☐ FAIL
备注:
```

### TC-003: 创建 API Key（核心测试）
```
前置条件: 已登录，在 API Keys 页面
步骤:
  1. 点击 "+ Create Key"
  2. 填写 Key 名称: test-manual
  3. 选择 Provider: nvidia
  4. 填写 Upstream API Key: sk-test-key-12345
  5. 点击 "选择全部模型"
  6. 点击 "Create"
预期: 
  - 不报 500 错误
  - 显示成功创建的密钥值
  - 密钥出现在列表中
结果: ☐ PASS  ☐ FAIL
备注: 此测试验证 Bug 2 是否真正修复
```

### TC-004: 复制密钥
```
前置条件: 已有创建的密钥
步骤:
  1. 在密钥列表中找到任意密钥
  2. 点击 "📋 复制" 按钮
预期: 密钥值复制到剪贴板，无报错
结果: ☐ PASS  ☐ FAIL
备注:
```

### TC-005: 禁用/启用密钥
```
前置条件: 已有创建的密钥
步骤:
  1. 点击 "⏸ 禁用" 按钮
  2. 检查密钥状态是否变为灰色/禁用
  3. 再次点击变为 "▶ 启用"
  4. 检查密钥状态是否恢复
预期: 状态正确切换
结果: ☐ PASS  ☐ FAIL
备注:
```

### TC-006: 删除密钥
```
前置条件: 已有创建的密钥
步骤:
  1. 点击 "Delete" 按钮
  2. 确认删除
预期: 密钥从列表中移除
结果: ☐ PASS  ☐ FAIL
备注:
```

### TC-007: 查看模型列表
```
前置条件: 已登录
步骤:
  1. 点击导航栏 "🤖 Models"
预期: 显示模型列表，包含 nvidia/deepseek 等
结果: ☐ PASS  ☐ FAIL
备注:
```

### TC-008: 查看 Providers
```
前置条件: 已登录
步骤:
  1. 点击导航栏 "🌐 Providers"
预期: 显示 Provider 列表
结果: ☐ PASS  ☐ FAIL
备注:
```

### TC-009: 登出
```
前置条件: 已登录
步骤:
  1. 点击 "🚪 Logout"
预期: 跳转回登录页面
结果: ☐ PASS  ☐ FAIL
备注:
```

---

## 🔧 API 端点测试（cURL 命令）

> 先登录获取 session_token，然后替换命令中的 `<session_token>`

### 1. 登录获取 Token
```bash
curl -X POST "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"token": "SfZwmRSYGse894Ab"}'
# 响应示例: {"ok": true, "token": "dd743a10-7d07-4943-8b44-4b4cfb935066"}
```

### 2. 获取密钥列表
```bash
curl -X GET "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/keys" \
  -H "Authorization: Bearer <session_token>"
# 响应示例: {"keys": [...]}
```

### 3. 创建密钥（验证 Bug 2 修复）
```bash
curl -X POST "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session_token>" \
  -d '{
    "name": "api-test-curl",
    "provider": "nvidia",
    "model": "*",
    "allowed_models": [],
    "api_secret": "sk-test-from-curl",
    "rate_limit": 60
  }'
# 预期: HTTP 200，返回 {"id": "...", "key_value": "sk_live_xxx", ...}
# 如果 Bug 2 未修复: HTTP 500 {"error": {"message": "Database error: 14 values for 15 columns"}}
```

### 4. 更新密钥
```bash
curl -X PATCH "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/keys/<key_id>" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session_token>" \
  -d '{"enabled": false}'
# 预期: {"ok": true}
```

### 5. 删除密钥
```bash
curl -X DELETE "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/keys/<key_id>" \
  -H "Authorization: Bearer <session_token>"
# 预期: {"ok": true}
```

### 6. 获取统计数据
```bash
curl -X GET "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/stats" \
  -H "Authorization: Bearer <session_token>"
```

### 7. 获取模型列表
```bash
curl -X GET "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/models" \
  -H "Authorization: Bearer <session_token>"
```

### 8. 获取 Providers
```bash
curl -X GET "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/providers" \
  -H "Authorization: Bearer <session_token>"
```

### 9. 登出
```bash
curl -X POST "https://cliproxyapi-lite-production.no9527.workers.dev/api/admin/logout" \
  -H "Authorization: Bearer <session_token>"
```

---

## ⚠️ 已知问题

### 问题 1: 前端 Create 按钮在自动化工具中无响应
| 项目 | 说明 |
|------|------|
| **现象** | agent-browser 点击 "Create" 按钮时，未触发 POST 请求 |
| **可能原因** | React 事件处理与浏览器自动化工具兼容性 |
| **Workaround** | 使用上述 cURL 命令测试 API，或手动点击 |

### 问题 2: Session Token 有效期未知
| 项目 | 说明 |
|------|------|
| **建议** | 测试 Token 过期后的行为（是否正确跳转回登录页）|

---

## 📊 CI/CD 验证

### 验证 D1 Schema 迁移
```bash
# 在 CI 日志中搜索以下输出，确认迁移成功
echo "Verifying api_keys schema..."
npx wrangler d1 execute cliproxyapi-lite-db --command="PRAGMA table_info(api_keys)" --remote --yes

# 应该显示 14-15 列，包括:
# - embeddings_provider
# - excluded_models
# - embeddings_model
```

### CI 运行历史
| Commit | 状态 | 说明 |
|--------|------|------|
| dab8eb9 | ✅ | 修复 SQL 占位符 (14→15) |
| 56675d1 | ✅ | 增强 D1 迁移脚本 |
| d19a045 | ✅ | 改进错误处理 |
| 1fa8011 | ✅ | 添加缺失数据库列 |

---

## 📋 测试结果汇总

| 用例 | 状态 | 执行人 | 日期 |
|------|------|--------|------|
| TC-001 登录 | ☐ | | |
| TC-002 Dashboard | ☐ | | |
| TC-003 创建密钥 | ☐ | | |
| TC-004 复制密钥 | ☐ | | |
| TC-005 禁用/启用 | ☐ | | |
| TC-006 删除密钥 | ☐ | | |
| TC-007 模型列表 | ☐ | | |
| TC-008 Providers | ☐ | | |
| TC-009 登出 | ☐ | | |

---

## 🎯 测试完成标准

所有用例必须 **PASS** 才能发布：
- [ ] TC-001 ~ TC-009 全部 PASS
- [ ] API 端点测试全部 PASS
- [ ] 无新增 error 日志

---

*文档生成时间：2026-03-30 19:52 GMT+8*
