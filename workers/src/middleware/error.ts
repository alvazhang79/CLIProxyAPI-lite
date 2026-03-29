import type { Context, Next } from 'hono';
import { i18n, type Lang } from '../i18n';
import type { OpenAIError } from '../types/api';

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public lang: Lang = 'en',
  ) {
    super(message);
    this.name = 'APIError';
  }

  toResponse(): Response {
    const str = i18n(this.lang as unknown as string);
    const msg = (str.error as Record<string, string>)[this.code] ?? this.message;

    const body: OpenAIError = {
      error: {
        message: msg,
        type: 'invalid_request_error',
        code: this.code,
        param: null,
      },
    };

    return new Response(JSON.stringify(body), {
      status: this.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': crypto.randomUUID(),
      },
    });
  }
}

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (err instanceof APIError) {
      return err.toResponse();
    }

    // Unexpected error
    console.error('[Worker Error]', err);
    const lang = detectLang(c.req.header('accept-language'));
    const str = i18n(lang);
    const body: OpenAIError = {
      error: {
        message: str.error.server_error,
        type: 'internal_error',
        code: 'server_error',
        param: null,
      },
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function detectLang(header: string | null | undefined): Lang {
  if (!header) return 'en';
  if (header.includes('zh')) return 'zh';
  return 'en';
}
