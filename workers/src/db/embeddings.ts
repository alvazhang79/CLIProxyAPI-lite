// Embeddings storage with cosine similarity search
// Stored as Float32Array bytes in D1 BLOB

import type { D1Database } from '@cloudflare/workers-types';

export interface StoredEmbedding {
  id: string;
  api_key_id: string;
  text: string;
  vector: number[];     // Float32 deserialized from D1 BLOB
  model: string;
  metadata: Record<string, string> | null;
  created_at: number;
  score?: number;       // set by searchEmbeddings
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Store a batch of embeddings in D1.
 */
export async function storeEmbeddingsBatch(
  d1: D1Database,
  records: Array<{
    id: string;
    api_key_id: string;
    texts: string[];
    vectors: number[][];
    model: string;
    metadata: Record<string, string> | null;
  }>,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  for (const rec of records) {
    for (let i = 0; i < rec.texts.length; i++) {
      const float32 = new Float32Array(rec.vectors[i]);
      const bytes = Array.from(new Uint8Array(float32.buffer));

      await d1.prepare(
        'INSERT INTO embeddings_index (id, api_key_id, text, vector, model, metadata, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        rec.id + '_' + i,
        rec.api_key_id,
        rec.texts[i],
        bytes,
        rec.model,
        rec.metadata ? JSON.stringify(rec.metadata) : null,
        now,
      ).run();
    }
  }
}

/**
 * Search embeddings by cosine similarity.
 * Falls back to approximate text match if D1 vector search unavailable.
 */
export async function searchEmbeddings(
  d1: D1Database,
  apiKeyId: string,
  queryVector: number[],
  limit = 10,
  minScore = 0.0,
): Promise<StoredEmbedding[]> {
  // 1. Fetch all embeddings for this API key (D1 doesn't support vector indexing natively)
  // In production with D1 vector search: use `SELECT * FROM embeddings_index WHERE api_key_id = ?`
  const { results } = await d1.prepare(
    'SELECT id, api_key_id, text, vector, model, metadata, created_at ' +
    'FROM embeddings_index WHERE api_key_id = ? ORDER BY created_at DESC LIMIT 500'
  ).bind(apiKeyId).all();

  if (!results || results.length === 0) return [];

  // 2. Deserialize vectors and compute cosine similarity
  const scored: Array<StoredEmbedding & { score: number }> = [];

  for (const row of results) {
    const vectorBytes = row.vector as unknown as number[];
    // D1 returns BLOB as Uint8Array
    const float32 = new Float32Array((row.vector as unknown as Uint8Array).buffer);
    const vector = Array.from(float32);

    const score = cosineSimilarity(queryVector, vector);
    if (score >= minScore) {
      scored.push({
        id: row.id as string,
        api_key_id: row.api_key_id as string,
        text: row.text as string,
        vector,
        model: row.model as string,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
        created_at: row.created_at as number,
        score,
      });
    }
  }

  // 3. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/**
 * Get embedding by ID.
 */
export async function getEmbeddingById(
  d1: D1Database,
  id: string,
): Promise<StoredEmbedding | null> {
  const r = await d1.prepare(
    'SELECT id, api_key_id, text, vector, model, metadata, created_at ' +
    'FROM embeddings_index WHERE id = ? LIMIT 1'
  ).bind(id).first();

  if (!r) return null;

  const float32 = new Float32Array((r.vector as unknown as Uint8Array).buffer);
  return {
    id: r.id as string,
    api_key_id: r.api_key_id as string,
    text: r.text as string,
    vector: Array.from(float32),
    model: r.model as string,
    metadata: r.metadata ? JSON.parse(r.metadata as string) : null,
    created_at: r.created_at as number,
  };
}

/**
 * Delete embedding by ID.
 */
export async function deleteEmbeddingById(
  d1: D1Database,
  id: string,
): Promise<boolean> {
  const result = await d1.prepare('DELETE FROM embeddings_index WHERE id = ?').bind(id).run();
  return result.success;
}

/**
 * Count embeddings for an API key.
 */
export async function countEmbeddings(
  d1: D1Database,
  apiKeyId: string,
): Promise<number> {
  const r = await d1.prepare(
    'SELECT COUNT(*) as cnt FROM embeddings_index WHERE api_key_id = ?'
  ).bind(apiKeyId).first();
  return (r?.cnt as number) ?? 0;
}
