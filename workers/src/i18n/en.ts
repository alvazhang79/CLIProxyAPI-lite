// English strings for API error messages
export const en = {
  error: {
    invalid_api_key: 'Invalid API key',
    api_key_disabled: 'This API key has been disabled',
    rate_limit_exceeded: 'Rate limit exceeded. Try again in a moment.',
    model_not_found: 'Model not found',
    upstream_error: 'Upstream provider error',
    invalid_request: 'Invalid request',
    server_error: 'Internal server error',
    method_not_allowed: 'Method not allowed',
    unauthorized: 'Unauthorized',
    forbidden: 'Forbidden',
    not_found: 'Not found',
    embedding_failed: 'Embedding generation failed',
  },
  upstream: {
    connection_error: 'Failed to connect to upstream provider',
    timeout: 'Upstream request timed out',
    invalid_response: 'Invalid response from upstream',
  },
} as const;

export type EnStrings = typeof en;
