-- CLIProxyAPI Lite — Model Presets Seed Data
-- Run with: wrangler d1 execute cliproxyapi-lite-db --file=scripts/seed-models.sql --remote
-- ⚠️ Requires custom_providers to be created first (id: <uuid-of-provider>)

-- ============================================================
-- OpenRouter Free Models
-- Provider ID: <replace-with-openrouter-provider-id>
-- ============================================================
INSERT OR IGNORE INTO custom_models (id, provider_id, model, alias, display_name, api_format, supports_streaming, supports_functions, context_window, enabled, created_at, updated_at)
VALUES
  (lower(hex(randomblob(16))), '<openrouter-provider-id>', 'moonshotai/kimi-k2:free', 'kimi-k2', 'Kimi K2 (Free)', 'openai', 1, 1, 32768, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<openrouter-provider-id>', 'deepseek-ai/deepseek-v3-0324:free', 'deepseek-v3.1', 'DeepSeek V3 (Free)', 'openai', 1, 1, 64000, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<openrouter-provider-id>', 'qwen/qwen2.5-72b-instruct:free', 'qwen-72b', 'Qwen 2.5 72B (Free)', 'openai', 1, 1, 32768, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<openrouter-provider-id>', 'anthropic/claude-3-haiku:free', 'claude-haiku', 'Claude 3 Haiku (Free)', 'openai', 1, 1, 200000, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<openrouter-provider-id>', 'google/gemini-pro-1.5:free', 'gemini-pro-15', 'Gemini Pro 1.5 (Free)', 'openai', 1, 1, 1000000, 1, strftime('%s', 'now'), strftime('%s', 'now'));

-- ============================================================
-- Gemini Free Models
-- Provider ID: <replace-with-gemini-provider-id>
-- ============================================================
INSERT OR IGNORE INTO custom_models (id, provider_id, model, alias, display_name, api_format, supports_streaming, supports_functions, context_window, enabled, created_at, updated_at)
VALUES
  (lower(hex(randomblob(16))), '<gemini-provider-id>', 'gemini-2.5-pro-exp-03-25', 'gemini-pro', 'Gemini 2.5 Pro', 'gemini', 1, 1, 1000000, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<gemini-provider-id>', 'gemini-2.5-flash', 'gemini-flash', 'Gemini 2.5 Flash', 'gemini', 1, 1, 1000000, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<gemini-provider-id>', 'gemini-1.5-flash', 'gemini-15-flash', 'Gemini 1.5 Flash', 'gemini', 1, 1, 1000000, 1, strftime('%s', 'now'), strftime('%s', 'now'));

-- ============================================================
-- OpenAI / Cohere Embeddings Models
-- Provider ID: <replace-with-cohere-provider-id>
-- ============================================================
INSERT OR IGNORE INTO custom_models (id, provider_id, model, alias, display_name, api_format, supports_streaming, supports_functions, context_window, enabled, created_at, updated_at)
VALUES
  (lower(hex(randomblob(16))), '<cohere-provider-id>', 'text-embedding-3-small', 'embed-3-small', 'OpenAI Embedding 3 Small', 'cohere', 0, 0, 8191, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<cohere-provider-id>', 'text-embedding-3-large', 'embed-3-large', 'OpenAI Embedding 3 Large', 'cohere', 0, 0, 8191, 1, strftime('%s', 'now'), strftime('%s', 'now')),
  (lower(hex(randomblob(16))), '<cohere-provider-id>', 'embed-english-v3.0', 'cohere-embed', 'Cohere Embed English v3', 'cohere', 0, 0, 512, 1, strftime('%s', 'now'), strftime('%s', 'now'));
