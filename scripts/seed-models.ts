// Model presets — bulk import popular free/cheap models
// Run with: wrangler d1 execute cliproxyapi-lite-db --file=scripts/seed-models.sql --remote

import type { D1Database } from '@cloudflare/workers-types';

interface ModelPreset {
  name: string;
  display_name: string;
  models: Array<{
    model: string;
    alias: string;
    display_name: string;
    api_format: 'openai' | 'gemini' | 'claude' | 'cohere';
    context_window: number;
    supports_streaming: boolean;
    supports_functions: boolean;
  }>;
}

export const PRESETS: Record<string, ModelPreset> = {
  'openrouter-free': {
    name: 'openrouter-free',
    display_name: 'OpenRouter Free Tier',
    models: [
      { model: 'moonshotai/kimi-k2:free', alias: 'kimi-k2', display_name: 'Kimi K2 (Free)', api_format: 'openai', context_window: 32768, supports_streaming: true, supports_functions: true },
      { model: 'deepseek-ai/deepseek-v3-0324:free', alias: 'deepseek-v3.1', display_name: 'DeepSeek V3 (Free)', api_format: 'openai', context_window: 64000, supports_streaming: true, supports_functions: true },
      { model: 'qwen/qwen2.5-72b-instruct:free', alias: 'qwen-72b', display_name: 'Qwen 2.5 72B (Free)', api_format: 'openai', context_window: 32768, supports_streaming: true, supports_functions: true },
      { model: 'anthropic/claude-3-haiku:free', alias: 'claude-haiku', display_name: 'Claude 3 Haiku (Free)', api_format: 'openai', context_window: 200000, supports_streaming: true, supports_functions: true },
      { model: 'google/gemini-pro-1.5:free', alias: 'gemini-pro-15', display_name: 'Gemini Pro 1.5 (Free)', api_format: 'openai', context_window: 1000000, supports_streaming: true, supports_functions: true },
    ],
  },
  'openrouter-popular': {
    name: 'openrouter-popular',
    display_name: 'OpenRouter Popular Models',
    models: [
      { model: 'openai/gpt-4o', alias: 'gpt-4o', display_name: 'GPT-4o', api_format: 'openai', context_window: 128000, supports_streaming: true, supports_functions: true },
      { model: 'anthropic/claude-3.5-sonnet', alias: 'claude-sonnet', display_name: 'Claude 3.5 Sonnet', api_format: 'openai', context_window: 200000, supports_streaming: true, supports_functions: true },
      { model: 'google/gemini-2.5-pro', alias: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', api_format: 'openai', context_window: 1000000, supports_streaming: true, supports_functions: true },
    ],
  },
  'gemini-free': {
    name: 'gemini-free',
    display_name: 'Google Gemini Free Tier',
    models: [
      { model: 'gemini-2.5-pro-exp-03-25', alias: 'gemini-pro', display_name: 'Gemini 2.5 Pro', api_format: 'gemini', context_window: 1000000, supports_streaming: true, supports_functions: true },
      { model: 'gemini-2.5-flash', alias: 'gemini-flash', display_name: 'Gemini 2.5 Flash', api_format: 'gemini', context_window: 1000000, supports_streaming: true, supports_functions: true },
      { model: 'gemini-1.5-flash', alias: 'gemini-15-flash', display_name: 'Gemini 1.5 Flash', api_format: 'gemini', context_window: 1000000, supports_streaming: true, supports_functions: true },
    ],
  },
  'claude-free': {
    name: 'claude-free',
    display_name: 'Anthropic Claude',
    models: [
      { model: 'claude-3-5-sonnet-20241022', alias: 'claude-3.5-sonnet', display_name: 'Claude 3.5 Sonnet', api_format: 'claude', context_window: 200000, supports_streaming: true, supports_functions: true },
      { model: 'claude-3-5-haiku-20241022', alias: 'claude-3.5-haiku', display_name: 'Claude 3.5 Haiku', api_format: 'claude', context_window: 200000, supports_streaming: true, supports_functions: true },
    ],
  },
  'embeddings': {
    name: 'embeddings',
    display_name: 'Embedding Models',
    models: [
      { model: 'text-embedding-3-small', alias: 'embed-3-small', display_name: 'OpenAI Embedding 3 Small', api_format: 'cohere', context_window: 8191, supports_streaming: false, supports_functions: false },
      { model: 'text-embedding-3-large', alias: 'embed-3-large', display_name: 'OpenAI Embedding 3 Large', api_format: 'cohere', context_window: 8191, supports_streaming: false, supports_functions: false },
      { model: 'embed-english-v3.0', alias: 'cohere-embed', display_name: 'Cohere Embed English v3', api_format: 'cohere', context_window: 512, supports_streaming: false, supports_functions: false },
    ],
  },
};

export async function seedPreset(
  d1: D1Database,
  providerId: string,
  presetName: string,
): Promise<{ added: number; skipped: number }> {
  const preset = PRESETS[presetName];
  if (!preset) return { added: 0, skipped: 0 };

  let added = 0;
  let skipped = 0;
  const now = Math.floor(Date.now() / 1000);

  for (const m of preset.models) {
    // Check if alias already exists
    const existing = await d1.prepare(
      'SELECT id FROM custom_models WHERE alias = ? LIMIT 1'
    ).bind(m.alias).first();

    if (existing) {
      skipped++;
      continue;
    }

    const id = crypto.randomUUID();
    await d1.prepare(
      'INSERT INTO custom_models (id, provider_id, model, alias, display_name, api_format, ' +
      'supports_streaming, supports_functions, context_window, enabled, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
    ).bind(
      id, providerId, m.model, m.alias, m.display_name, m.api_format,
      m.supports_streaming ? 1 : 0, m.supports_functions ? 1 : 0,
      m.context_window, now, now
    ).run();

    added++;
  }

  return { added, skipped };
}
