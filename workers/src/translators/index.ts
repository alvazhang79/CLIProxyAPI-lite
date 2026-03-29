// Translator index — format conversion between OpenAI and provider-native formats
import type { OpenAIRequest, OpenAIResponse, OpenAISSEDelta } from '../types/api';
import type { APIFormat } from '../types/provider';

export interface Translator {
  format: APIFormat;
  // Convert OpenAI request → provider format
  toProvider(model: string, body: OpenAIRequest): ProviderRequest;
  // Convert provider response → OpenAI format
  toOpenAI(response: unknown, model: string): OpenAIResponse;
  // Convert provider SSE chunk → OpenAI SSE delta
  toOpenAIStream(chunk: unknown, model: string, index?: number): OpenAISSEDelta;
}

export interface ProviderRequest {
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface ProviderResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: unknown[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string };
}

// ---- Registry ----
const translators: Partial<Record<APIFormat, Translator>> = {};

export function registerTranslator(t: Translator): void {
  translators[t.format] = t;
}

export function getTranslator(format: APIFormat): Translator {
  return translators[format] ?? translators['openai']!;
}

// ---- OpenAI Translator (passthrough) ----
registerTranslator({
  format: 'openai',
  toProvider(model, body) {
    return { body: { ...body, model } };
  },
  toOpenAI(res, model) {
    const r = res as ProviderResponse;
    return {
      id: r.id ?? `chatcmpl-${randomId()}`,
      object: 'chat.completion' as const,
      created: r.created ?? Math.floor(Date.now() / 1000),
      model: r.model ?? model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      choices: (r.choices ?? []) as any,
      usage: {
        prompt_tokens: r.usage?.prompt_tokens ?? 0,
        completion_tokens: r.usage?.completion_tokens ?? 0,
        total_tokens: r.usage?.total_tokens ?? 0,
      },
    };
  },
  toOpenAIStream(chunk, _model, index = 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = chunk as any;
    return {
      index,
      delta: {
        role: c.delta?.role as 'assistant' | undefined,
        content: c.delta?.content ?? null,
      },
      finish_reason: c.finish_reason ?? null,
    };
  },
});

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
