// Claude format translator — converts OpenAI ↔ Claude Messages API format
import type { OpenAIRequest, OpenAIResponse, OpenAISSEDelta, OpenAIToolCall } from '../types/api';
import { registerTranslator } from './index';
import type { ProviderRequest } from './index';

function openaiToClaude(body: OpenAIRequest): {
  anthropic_version: string;
  messages: ClaudeMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
} {
  const messages: ClaudeMessage[] = [];
  let system = '';

  for (const msg of body.messages) {
    if (msg.role === 'system') {
      system += (msg.content as string ?? '') + '\n';
      continue;
    }

    const content: ClaudeContent[] = [];

    if (typeof msg.content === 'string') {
      content.push({ type: 'text', text: msg.content });
    }

    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    if (msg.role === 'tool') {
      content.push({
        type: 'tool_result',
        tool_use_id: msg.tool_call_id ?? '',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }

    if (content.length > 0) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : msg.role,
        content,
      });
    }
  }

  return {
    anthropic_version: 'vertex-2023-06-01',
    messages,
    ...(system.trim() ? { system: system.trim() } : {}),
    max_tokens: body.max_tokens ?? body.max_completion_tokens ?? 1024,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
    ...(body.stop ? { stop_sequences: Array.isArray(body.stop) ? body.stop : [body.stop] } : {}),
  };
}

function claudeToOpenAI(response: unknown, model: string): OpenAIResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = response as any;
  const content = r.content ?? [];
  let text = '';
  const toolCalls: OpenAIToolCall[] = [];

  for (const block of content) {
    if (block.type === 'text') text += block.text ?? '';
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id ?? '',
        type: 'function',
        function: {
          name: block.name ?? '',
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }

  return {
    id: r.id ?? `chatcmpl-${randomId()}`,
    object: 'chat.completion' as const,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: text || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finish_reason: (r.stop_reason === 'end_turn' ? 'stop' : r.stop_reason) as OpenAIResponse['choices'][0]['finish_reason'],
    }],
    usage: {
      prompt_tokens: r.usage?.input_tokens ?? 0,
      completion_tokens: r.usage?.output_tokens ?? 0,
      total_tokens: (r.usage?.input_tokens ?? 0) + (r.usage?.output_tokens ?? 0),
    },
  };
}

function claudeStreamToOpenAI(chunk: unknown, _model: string): OpenAISSEDelta | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = chunk as any;
  if (c.type === 'content_block_delta') {
    if (c.delta?.type === 'text_delta') {
      return {
        index: c.index ?? 0,
        delta: { content: c.delta.text ?? null },
        finish_reason: null,
      };
    }
  }
  if (c.type === 'message_delta') {
    return {
      index: 0,
      delta: {},
      finish_reason: c.delta?.stop_reason ?? null,
    };
  }
  return null;
}

registerTranslator({
  format: 'claude',
  toProvider(_model, body) {
    return { body: openaiToClaude(body) };
  },
  toOpenAI(res, model) {
    return claudeToOpenAI(res, model);
  },
  toOpenAIStream(chunk, _model, index = 0) {
    return claudeStreamToOpenAI(chunk, '') ?? {
      index,
      delta: { content: null },
      finish_reason: null,
    };
  },
});

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// Type stubs for this file
interface ClaudeMessage { role: string; content: ClaudeContent[] }
type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };
