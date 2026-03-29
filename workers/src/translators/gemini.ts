// Gemini format translator — converts OpenAI ↔ Gemini generateContent format
import type { OpenAIRequest, OpenAIResponse, OpenAISSEDelta, OpenAIToolCall } from '../types/api';
import { registerTranslator } from './index';
import type { ProviderRequest } from './index';

function openaiToGemini(body: OpenAIRequest): {
  contents: GeminiContent[];
  generationConfig: Record<string, unknown>;
  systemInstruction?: GeminiSystemInstruction;
} {
  const contents: GeminiContent[] = [];
  let systemText = '';

  for (const msg of body.messages) {
    if (msg.role === 'system') {
      systemText += (msg.content as string ?? '') + '\n';
      continue;
    }

    const parts: GeminiPart[] = [];
    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    }

    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          },
        });
      }
    }

    if (msg.role === 'tool') {
      parts.push({
        functionResponse: {
          name: msg.name ?? '',
          response: { output: msg.content as string },
        },
      });
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts,
      });
    }
  }

  const generationConfig: Record<string, unknown> = {};
  if (body.temperature !== undefined) generationConfig.temperature = body.temperature;
  if (body.max_tokens !== undefined) generationConfig.maxOutputTokens = body.max_tokens;
  else if (body.max_completion_tokens !== undefined) generationConfig.maxOutputTokens = body.max_completion_tokens;
  if (body.top_p !== undefined) generationConfig.topP = body.top_p;
  if (body.stop !== undefined) {
    generationConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  }

  const result: ReturnType<typeof openaiToGemini> = { contents, generationConfig };
  if (systemText) {
    result.systemInstruction = { parts: [{ text: systemText.trim() }] };
  }

  return result;
}

function geminiToOpenAI(response: unknown, model: string): OpenAIResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = response as any;
  const msg = r.candidates?.[0]?.content?.parts ?? [];
  let content = '';
  const toolCalls: OpenAIToolCall[] = [];

  for (const part of msg) {
    if (part.text) content += part.text ?? '';
    if (part.functionCall) {
      toolCalls.push({
        id: `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        type: 'function',
        function: {
          name: part.functionCall.name ?? '',
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        },
      });
    }
  }

  return {
    id: `chatcmpl-${randomId()}`,
    object: 'chat.completion' as const,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: content || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finish_reason: (r.candidates?.[0]?.finishReason ?? 'stop') as OpenAIResponse['choices'][0]['finish_reason'],
    }],
    usage: {
      prompt_tokens: r.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: r.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: r.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

function geminiStreamToOpenAI(chunk: unknown, _model: string): OpenAISSEDelta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = chunk as any;
  const parts = c.candidates?.[0]?.content?.parts ?? [];
  let text = '';
  for (const p of parts) {
    if (p.text) text += p.text;
  }
  return {
    index: 0,
    delta: { content: text || null },
    finish_reason: c.candidates?.[0]?.finishReason ?? null,
  };
}

registerTranslator({
  format: 'gemini',
  toProvider(_model, body) {
    const { contents, generationConfig, systemInstruction } = openaiToGemini(body);
    return {
      body: {
        contents,
        generationConfig,
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    };
  },
  toOpenAI(res, model) {
    return geminiToOpenAI(res, model);
  },
  toOpenAIStream(chunk, _model, index = 0) {
    return { ...geminiStreamToOpenAI(chunk, ''), index };
  },
});

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// Gemini types
interface GeminiContent { role?: string; parts: GeminiPart[] }
interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name?: string; response?: { output?: string } };
}
interface GeminiSystemInstruction { parts: { text: string }[]; }
