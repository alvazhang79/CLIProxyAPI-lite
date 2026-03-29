// OpenAI-compatible HTTP client with streaming SSE support
// Supports custom headers (from translator layer) and proxy routing

export interface ProviderResponse {
  data: unknown;
  status: number;
  headers: Headers;
}

export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  delta?: string;
  finish_reason?: string;
  raw?: string;   // Raw SSE line for translator to parse
}

export class OpenAICompatibleProvider {
  constructor(
    public baseUrl: string,
    public authValue: string,
    public authHeader = 'Authorization',
    public extraHeaders: Record<string, string> = {},
    public proxyUrl?: string,
  ) {}

  protected buildHeaders(extra?: Record<string, string>): Headers {
    const h = new Headers({
      'Content-Type': 'application/json',
      [this.authHeader]: this.authValue.startsWith('Bearer ')
        ? this.authValue
        : `Bearer ${this.authValue}`,
      ...this.extraHeaders,
      ...extra,
    });
    return h;
  }

  protected buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '');
    const p = path.startsWith('/') ? path : '/' + path;
    return base + p;
  }

  /**
   * Standard chat completion (OpenAI format passthrough).
   * Uses this.extraHeaders from constructor.
   */
  async chatCompletion(
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
  ): Promise<ProviderResponse> {
    return this.chatCompletionRaw(model, { ...body, model, stream }, this.extraHeaders);
  }

  /**
   * Raw chat completion — accepts custom headers from translator.
   */
  async chatCompletionRaw(
    model: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<ProviderResponse> {
    const url = this.buildUrl('/v1/chat/completions');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(extraHeaders),
        body: JSON.stringify(body),
        // @ts-ignore - Cloudflare fetch extensions
        cf: this.proxyUrl ? { proxy: this.proxyUrl } : undefined,
      });
      const data = await res.json();
      return { data, status: res.status, headers: res.headers };
    } catch (e: unknown) {
      const err = e as Error;
      throw new Error('Upstream fetch failed: ' + err.message);
    }
  }

  /**
   * SSE streaming — returns parsed deltas.
   */
  async *streamChatCompletion(
    model: string,
    body: Record<string, unknown>,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    yield* this.streamChatCompletionRaw(model, { ...body, model, stream: true }, this.extraHeaders);
  }

  /**
   * Raw SSE streaming — yields raw SSE lines for translator to parse.
   */
  async *streamChatCompletionRaw(
    _model: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const url = this.buildUrl('/v1/chat/completions');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(extraHeaders),
        body: JSON.stringify({ ...body, stream: true }),
        // @ts-ignore
        cf: this.proxyUrl ? { proxy: this.proxyUrl } : undefined,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done' };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content ?? '';
              const finish = parsed.choices?.[0]?.finish_reason;
              yield {
                type: 'delta',
                delta,
                finish_reason: finish,
                raw: data,
              };
            } catch {
              // Skip malformed lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: 'done' };
    } catch (e: unknown) {
      const err = e as Error;
      yield { type: 'error', delta: err.message };
    }
  }

  async embeddings(
    model: string,
    input: string | string[],
    encodingFormat: 'float' | 'base64' = 'float',
  ): Promise<ProviderResponse> {
    const url = this.buildUrl('/v1/embeddings');
    const payload = { model, input, encoding_format: encodingFormat };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        // @ts-ignore
        cf: this.proxyUrl ? { proxy: this.proxyUrl } : undefined,
      });
      const data = await res.json();
      return { data, status: res.status, headers: res.headers };
    } catch (e: unknown) {
      throw new Error('Embedding request failed: ' + (e as Error).message);
    }
  }
}
