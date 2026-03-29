// ============================================================
// API Types — shared request/response shapes
// ============================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: OpenAITool[];
  tool_choice?: OpenAIAuto | OpenAIFunction | 'none';
}

export interface OpenAIAuto { type: 'auto' }
export interface OpenAIFunction { type: 'function'; function: { name: string } }

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  system_fingerprint?: string;
}

export interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Streaming
export interface OpenAISSEDelta {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason?: string | null;
}

// Embeddings
export interface EmbeddingsRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  index?: boolean;
  metadata?: Record<string, string>;
  // RAG search (admin/advanced)
  search?: boolean;
  query_vector?: number[];
  top_k?: number;
  min_score?: number;
}

export interface EmbeddingsResponse {
  object: 'list';
  data: EmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingData {
  object: 'embedding';
  embedding: number[];
  index: number;
}

// Error
export interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string | null;
    param: string | null;
  };
}
