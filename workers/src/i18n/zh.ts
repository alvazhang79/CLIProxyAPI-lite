// Chinese strings for API error messages
export const zh = {
  error: {
    invalid_api_key: '无效的 API 密钥',
    api_key_disabled: '此 API 密钥已被禁用',
    rate_limit_exceeded: '超出速率限制，请稍后重试',
    model_not_found: '模型未找到',
    upstream_error: '上游服务商错误',
    invalid_request: '无效的请求',
    server_error: '服务器内部错误',
    method_not_allowed: '不允许的请求方法',
    unauthorized: '未授权',
    forbidden: '禁止访问',
    not_found: '资源未找到',
    embedding_failed: '生成向量嵌入失败',
  },
  upstream: {
    connection_error: '无法连接上游服务商',
    timeout: '上游请求超时',
    invalid_response: '上游返回了无效的响应',
  },
} as const;

export type ZhStrings = typeof zh;
