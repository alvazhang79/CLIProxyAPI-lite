// /v1/chat/completions handler — uses translator layer for multi-format support
import type { Context } from 'hono';
import { z } from 'zod';
import { authenticateRequest } from './auth';
import { getProviderForAPIKey } from '../providers';
import { APIError } from '../middleware/error';
import { resolveBuiltinModel, insertRequestLog } from '../db/d1';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { detectLang } from '../i18n';
import { getTranslator } from '../translators/index';
import type { OpenAIRequest, OpenAIResponse } from '../types/api';
import type { APIFormat } from '../types/provider';

// Import all translators (registers them)
import '../translators/gemini';
import '../translators/claude';

const ChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.union([z.string(), z.null()]),
    name: z.string().optional(),
    tool_calls: z.any().optional(),
    tool_call_id: z.string().optional(),
  })),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  n: z.number().optional(),
  max_tokens: z.number().optional(),
  max_completion_tokens: z.number().optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  logit_bias: z.record(z.number()).optional(),
  user: z.string().optional(),
  tools: z.any().optional(),
  tool_choice: z.any().optional(),
}).passthrough();

export async function handleChatCompletions(c: Context) {
  const d1 = c.get('D1');

  // Authenticate
  const keyRecord = await authenticateRequest(c);

  // Rate limit
  await rateLimitMiddleware(c, async () => {}, () => keyRecord.id, () => keyRecord.rate_limit);

  // Parse & validate body
  let body: OpenAIRequest;
  try {
    const json = await c.req.json();
    body = ChatRequestSchema.parse(json) as OpenAIRequest;
  } catch {
    throw new APIError(400, 'invalid_request', 'Invalid JSON body', detectLang(c.req.header('accept-language')));
  }

  const requestedModel = body.model;
  const lang = detectLang(c.req.header('accept-language'));

  // Resolve model: key-level override wins
  let resolvedModel = keyRecord.model;
  if (!resolvedModel || resolvedModel === '*') {
    resolvedModel = requestedModel;
  }

  // Check excluded models
  if (keyRecord.excluded_models?.includes(resolvedModel)) {
    throw new APIError(403, 'forbidden', `Model ${resolvedModel} is not allowed with this API key`, lang);
  }

  // Get provider instance
  const { route, provider } = await getProviderForAPIKey(d1, {
    ...keyRecord,
    model: resolvedModel,
  });

  const upstreamModel = route.upstream_model;
  const apiFormat: APIFormat = route.api_format;
  const translator = getTranslator(apiFormat);
  const doStream = body.stream ?? false;

  // Build upstream body using translator
  const upstreamBody = translator.toProvider(upstreamModel, body);

  const startTime = Date.now();

  if (doStream) {
    return streamResponse(c, d1, provider, upstreamBody, translator, upstreamModel, route.provider as string, keyRecord.id, lang);
  } else {
    return nonStreamResponse(c, d1, provider, upstreamBody, translator, upstreamModel, route.provider as string, keyRecord.id, startTime, lang);
  }
}

async function nonStreamResponse(
  c: Context,
  d1: D1Database,
  provider: import('../providers/openai').OpenAICompatibleProvider,
  upstreamBody: { body: Record<string, unknown>; headers?: Record<string, string> },
  translator: ReturnType<typeof getTranslator>,
  model: string,
  providerName: string,
  keyId: string,
  startTime: number,
  lang: ReturnType<typeof detectLang>,
) {
  try {
    // Call upstream — use custom headers from translator if present
    const res = await provider.chatCompletionRaw(
      model,
      upstreamBody.body,
      upstreamBody.headers,
    );

    if (res.status !== 200) {
      const err = (res.data as { error?: { message?: string } }).error;
      throw new APIError(res.status, 'upstream_error', err?.message ?? 'Upstream error', lang);
    }

    // Translate response back to OpenAI format
    const data = translator.toOpenAI(res.data as Parameters<typeof translator.toOpenAI>[0], model) as OpenAIResponse;
    const latency = Date.now() - startTime;

    // Log request
    insertRequestLog(d1, {
      api_key_id: keyId,
      endpoint: '/v1/chat/completions',
      provider: providerName,
      model,
      tokens_used: data.usage?.total_tokens ?? null,
      latency_ms: latency,
      status_code: 200,
      error_msg: null,
    }).catch(() => {});

    return c.json(data);
  } catch (e) {
    if (e instanceof APIError) throw e;
    throw new APIError(502, 'upstream_error', 'Failed to get completion', lang);
  }
}

async function streamResponse(
  c: Context,
  d1: D1Database,
  provider: import('../providers/openai').OpenAICompatibleProvider,
  upstreamBody: { body: Record<string, unknown>; headers?: Record<string, string> },
  translator: ReturnType<typeof getTranslator>,
  model: string,
  providerName: string,
  keyId: string,
  lang: ReturnType<typeof detectLang>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };

      try {
        let finishSent = false;

        for await (const chunk of provider.streamChatCompletionRaw(
          model,
          upstreamBody.body,
          upstreamBody.headers,
        )) {
          if (chunk.type === 'done') {
            if (!finishSent) {
              finishSent = true;
              enqueue('data: [DONE]\n\n');
            }
            break;
          }

          if (chunk.type === 'delta' && chunk.raw) {
            // Parse raw SSE line as provider-specific format
            const providerChunk = parseSSEChunk(chunk.raw);
            if (providerChunk) {
              const openaiDelta = translator.toOpenAIStream(providerChunk as Parameters<typeof translator.toOpenAIStream>[0], model);
              const sse = {
                id: `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [openaiDelta],
              };
              enqueue('data: ' + JSON.stringify(sse) + '\n\n');
            }
          }
        }

        insertRequestLog(d1, {
          api_key_id: keyId,
          endpoint: '/v1/chat/completions (stream)',
          provider: providerName,
          model,
          tokens_used: null,
          latency_ms: null,
          status_code: 200,
          error_msg: null,
        }).catch(() => {});
      } catch (e) {
        const err = e as Error;
        enqueue('data: ' + JSON.stringify({
          error: { message: err.message, code: 'upstream_error' },
        }) + '\n\n');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-Id': crypto.randomUUID(),
    },
  });
}

function parseSSEChunk(raw: string): unknown {
  try {
    // Handle "data: {...}" format
    const trimmed = raw.trim();
    if (trimmed.startsWith('data: ')) {
      const data = trimmed.slice(6);
      if (data === '[DONE]') return null;
      return JSON.parse(data);
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
