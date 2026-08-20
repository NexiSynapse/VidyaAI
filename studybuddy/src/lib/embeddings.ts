import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Generate an embedding vector for a single text using OpenAI's embeddings API.
 * This is intentionally separate from callLLM (which only handles chat completions).
 */
export async function embedText(
  text: string,
  model = 'text-embedding-3-small',
  dimensions = 1536
): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model,
    input: text,
    dimensions,
  });
  return response.data[0].embedding;
}
