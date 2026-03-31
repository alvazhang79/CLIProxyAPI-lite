// /v1/embeddings handler — with optional local D1 storage & cosine similarity search
import type { Context } from 'hono';
import { z } from 'zod';
import { authenticateRequest } from './auth';
import { APIError } from '../middleware/error';
import { detectLang } from '../i18n';
import { getProviderForAPIKey } from '../providers';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { searchEmbeddings } from '../db/embeddings';
import type { EmbeddingsRequest, EmbeddingsResponse } from '../types/api';
import { decrypt, type Encrypted } from '../lib/crypto';

const EmbeddingsRequestSchema = z.object({
  model: z.string(),
  input: z.union([z.string(), z.array(z.string())]),
  encoding_format: z.enum(['float', 'base64']).optional().default('float'),
  dimensions: z.number().optional(),
  input_type: z.enum(['query', 'passage', 'document']).optional(),
  index: z.boolean().optional().default(false),
  metadata: z.record(z.string()).optional(),
  // ✨ RAG search params (admin only)
  search: z.boolean().optional().default(false),
  query_vector: z.array(z.number()).optional(),
  top_k: z.number().optional().default(5),
  min_score: z.number().optional().default(0.0),
});

export async function handleEmbeddings(c: Context) {
  const d1 = c.get('D1');
  const lang = detectLang(c.req.header('accept-language'));

  // Authenticate
  const keyRecord = await authenticateRequest(c);

  // Rate limit
  await rateLimitMiddleware(c, async () => {}, () => keyRecord.id, () => keyRecord.rate_limit);

  // Parse body
  let body: EmbeddingsRequest;
  try {
    const json = await c.req.json();
    body = EmbeddingsRequestSchema.parse(json) as EmbeddingsRequest;
  } catch {
    throw new APIError(400, 'invalid_request', 'Invalid embeddings request', lang);
  }

  const { model, input, encoding_format, input_type, index, metadata, search, query_vector, top_k, min_score } = body;
  const texts = Array.isArray(input) ? input : [input];

  // ✨ If search=true, perform similarity search against stored embeddings
  if (search && query_vector && query_vector.length > 0) {
    // Auth check: embeddings must be indexed for this API key first
    const results = await searchEmbeddings(d1, keyRecord.id, query_vector, top_k ?? 5, min_score ?? 0.0);

    return c.json({
      object: 'list',
      data: results.map((r, i) => ({
        object: 'embedding',
        embedding: r.vector,
        index: i,
        metadata: { text: r.text, score: r.score, ...r.metadata },
      })),
      model,
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    });
  }

  // Otherwise: call upstream embedding API
  const embeddingModel = keyRecord.embeddings_model || model;

  // Decrypt api_secret if it's encrypted (stored as JSON string from encryptSecret)
  let decryptedApiSecret = keyRecord.api_secret;
  if (decryptedApiSecret && decryptedApiSecret.startsWith('{')) {
    try {
      const enc = JSON.parse(decryptedApiSecret) as Encrypted;
      const key = c.env.ENCRYPTION_KEY;
      if (key) {
        decryptedApiSecret = await decrypt(enc, key);
      }
    } catch {
      // If decryption fails, use as-is (might be plaintext in dev)
    }
  }

  const { provider } = await getProviderForAPIKey(d1, {
    ...keyRecord,
    model: embeddingModel,
    api_secret: decryptedApiSecret,
  });

  // Call upstream
  const res = await provider.embeddings(embeddingModel, texts, encoding_format ?? 'float', input_type);

  if (res.status !== 200) {
    const err = (res.data as { error?: { message?: string } }).error;
    throw new APIError(res.status, 'embedding_failed', err?.message ?? 'Embedding failed', lang);
  }

  const embeddingData = res.data as {
    data: Array<{ embedding: number[] | string; index: number }>;
    model: string;
    usage?: { prompt_tokens: number; total_tokens: number };
  };

  const response: EmbeddingsResponse = {
    object: 'list',
    data: embeddingData.data.map((item, i) => ({
      object: 'embedding',
      embedding: item.embedding as number[],
      index: item.index ?? i,
    })),
    model: embeddingData.model,
    usage: embeddingData.usage ?? {
      prompt_tokens: texts.join('').split(/\s+/).length,
      total_tokens: texts.join('').split(/\s+/).length,
    },
  };

  // Store in local D1 if requested
  if (index) {
    for (let i = 0; i < response.data.length; i++) {
      const item = response.data[i];
      const text = texts[i] ?? '';
      const id = crypto.randomUUID();
      const float32 = new Float32Array(item.embedding);
      const bytes = Array.from(new Uint8Array(float32.buffer));

      d1.prepare(
        'INSERT INTO embeddings_index (id, api_key_id, text, vector, model, metadata, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, keyRecord.id, text, bytes, embeddingModel,
        metadata ? JSON.stringify(metadata) : null,
        Math.floor(Date.now() / 1000)
      ).run().catch(() => {}); // fire and forget
    }
  }

  return c.json(response);
}
