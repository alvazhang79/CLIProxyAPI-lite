# CLIProxyAPI Lite - 完整测试计划 v2.0

## 测试环境

- **Workers API**: https://cliproxyapi-lite-production.no9527.workers.dev
- **管理后台**: https://5c1bcbf5.cliproxyapi-lite-4yc.pages.dev
- **管理员 Token**: `SfZwmRSYGse894Ab`

## 测试范围

1. Workers API 功能测试
2. 管理后台 UI 测试
3. 删除功能专项测试
4. 代理转发测试

---

## 第一部分：Workers API 功能测试

### TC-001: 管理员登录
**目的**: 验证管理员 token 认证
**步骤**: POST /api/admin/login with token
**预期**: 返回 {ok: true, token: <session_token>}

### TC-002: 获取 Dashboard 统计
**目的**: 验证 Dashboard API
**步骤**: GET /api/admin/dashboard
**预期**: 返回统计数据

### TC-003: 创建 API Key
**目的**: 验证密钥创建功能
**步骤**: POST /api/admin/keys with name, provider, model
**预期**: 返回新创建的密钥信息

### TC-004: 获取密钥列表
**目的**: 验证密钥列表 API
**步骤**: GET /api/admin/keys
**预期**: 返回密钥数组

### TC-005: 禁用/启用密钥
**目的**: 验证密钥状态切换
**步骤**: PATCH /api/admin/keys/{id} with enabled=false/true
**预期**: 返回 {ok: true}

### TC-006: 删除密钥
**目的**: 验证密钥删除功能
**步骤**: DELETE /api/admin/keys/{id}
**预期**: 返回 {ok: true}

### TC-007: 创建 Provider
**目的**: 验证 Provider 创建
**步骤**: POST /api/admin/providers with name, base_url, api_key
**预期**: 返回新 Provider 信息

### TC-008: 删除 Provider
**目的**: 验证 Provider 删除
**步骤**: DELETE /api/admin/providers/{id}
**预期**: 返回 {ok: true}

### TC-009: 创建 Model
**目的**: 验证 Model 创建
**步骤**: POST /api/admin/models with provider_id, model, alias
**预期**: 返回新 Model 信息

### TC-010: 删除 Model
**目的**: 验证 Model 删除
**步骤**: DELETE /api/admin/models/{id}
**预期**: 返回 {ok: true}

---

## 第二部分：管理后台 UI 测试

### TC-101: 页面加载
**目的**: 验证管理后台可访问
**步骤**: 访问管理后台 URL
**预期**: 显示登录页面

### TC-102: 登录流程
**目的**: 验证登录功能
**步骤**: 输入管理员 token，点击登录
**预期**: 跳转到 Dashboard 页面

### TC-103: 导航测试
**目的**: 验证侧边栏导航
**步骤**: 点击各导航项
**预期**: 正确切换到对应页面

---

## 第三部分：删除功能专项测试

### TC-201: API Key 删除 - 后端 API
**目的**: 验证密钥删除 API 正常工作
**步骤**: 创建测试密钥 -> 调用 DELETE API -> 验证密钥已删除
**预期**: API 返回成功，密钥从列表中消失

### TC-202: Provider 删除 - 后端 API
**目的**: 验证 Provider 删除 API
**步骤**: 创建测试 Provider -> 调用 DELETE API -> 验证已删除
**预期**: API 返回成功

### TC-203: Model 删除 - 后端 API
**目的**: 验证 Model 删除 API
**步骤**: 创建测试 Model -> 调用 DELETE API -> 验证已删除
**预期**: API 返回成功

---

## 测试执行脚本

测试将使用 curl 和 agent-browser 工具自动执行。
