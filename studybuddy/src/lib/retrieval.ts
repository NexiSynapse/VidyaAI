import { supabaseAdmin } from './supabase';
import { embedText } from './embeddings';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  page?: number;
  section?: string;
  similarity?: number;
}

export interface Citation {
  index: number;
  snippet: string;
  page?: number;
  section?: string;
  documentId: string;
}

export interface RetrievalOptions {
  documentId?: string;
  topic?: string;
  topK?: number;
  similarityThreshold?: number;
}

/**
 * Embed a user question using the shared embeddings helper.
 * (Kept as a thin named wrapper so callers read intent clearly.)
 */
export async function embedQuery(query: string): Promise<number[]> {
  return embedText(query, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS);
}

/**
 * Retrieve the most relevant chunks for a query.
 *
 * Tries the pgvector cosine-search RPC first (matches the `match_chunks`
 * SQL in the migration). If the RPC isn't set up yet, it falls back to
 * pulling candidate rows and computing cosine similarity in memory so the
 * demo loop still works end-to-end.
 */
export async function retrieveChunks(
  queryEmbedding: number[],
  options: RetrievalOptions = {}
): Promise<Chunk[]> {
  const {
    documentId,
    topic,
    topK = 5,
    similarityThreshold = 0.7,
  } = options;

  // Preferred path: pgvector RPC does the cosine search server-side.
  try {
    const rpcParams: Record<string, unknown> = {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: topK * 2,
    };
    if (documentId) rpcParams.document_id = documentId;
    if (topic) rpcParams.topic = topic;

    const { data, error } = await supabaseAdmin.rpc('match_chunks', rpcParams);
    if (!error && data && data.length > 0) {
      return (data as Chunk[])
        .map((c) => ({ ...c, similarity: c.similarity ?? 0 }))
        .sort((a, b) => b.similarity! - a.similarity!)
        .slice(0, topK);
    }
    if (error) {
      console.warn('match_chunks RPC failed, using in-memory fallback:', error.message);
    }
  } catch (rpcErr) {
    console.warn('match_chunks RPC unavailable, using in-memory fallback:', rpcErr);
  }

  // Fallback path: fetch candidate rows and rank in memory.
  let query = supabaseAdmin
    .from('chunks')
    .select('id, document_id, content, embedding, page, section')
    .limit(200);

  if (documentId) query = query.eq('document_id', documentId);
  if (topic) query = query.eq('topic', topic);

  const { data: chunks, error } = await query;
  if (error) {
    console.error('Error fetching chunks:', error);
    return [];
  }
  if (!chunks || chunks.length === 0) return [];

  const typedChunks = chunks as Array<{
    id: string;
    document_id: string;
    content: string;
    embedding: number[];
    page?: number;
    section?: string;
  }>;

  return typedChunks
    .map((chunk: typeof typedChunks[0]) => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
    }))
    .filter((chunk) => chunk.similarity! >= similarityThreshold)
    .sort((a, b) => b.similarity! - a.similarity!)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Build the grounded RAG prompt and the citation list the API returns.
 */
export function buildRAGPrompt(
  question: string,
  chunks: Chunk[],
  history: { role: string; content: string }[] = []
): {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  citations: Citation[];
} {
  const context = chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}]${chunk.page ? ` (page ${chunk.page})` : ''}${
          chunk.section ? ` - ${chunk.section}` : ''
        }:\n${chunk.content}`
    )
    .join('\n\n---\n\n');

  const citations: Citation[] = chunks.map((chunk, i) => ({
    index: i + 1,
    snippet: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    page: chunk.page,
    section: chunk.section,
    documentId: chunk.document_id,
  }));

  const systemPrompt = `You are an AI study teacher. Answer the student's question using ONLY the provided context from their course materials.

Rules:
1. If the answer is not in the context, say exactly: "I couldn't find this in your uploaded materials. Try uploading more documents or rephrasing your question."
2. Cite sources using [Source X] format inline whenever you use information from the context.
3. Be clear, educational, and encouraging.
4. Use examples from the material when possible.
5. If asked to explain a concept, structure it: definition → explanation → example → connection to related concepts.

Context from student's materials:
${context}`;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last 6 messages) for coherence.
  for (const msg of history.slice(-6)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: question });

  return { messages, citations };
}
