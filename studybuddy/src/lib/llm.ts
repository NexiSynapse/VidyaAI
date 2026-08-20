import OpenAI from 'openai';
import { Groq } from 'groq-sdk';

type Provider = 'groq' | 'openai';

interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

let openaiClient: OpenAI | null = null;
let groqClient: Groq | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

function toUsage(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null): LLMResponse['usage'] {
  if (!usage) return undefined;
  return {
    prompt_tokens: usage.prompt_tokens ?? 0,
    completion_tokens: usage.completion_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
  };
}

/**
 * Call an LLM for a non-streaming chat completion.
 * Always pass stream=false (or omit it) — the streaming variant lives in streamLLM().
 */
export async function callLLM(
  provider: Provider,
  messages: Message[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const { model, temperature = 0.3, maxTokens = 2000, stream = false } = options;

  if (stream) {
    return streamLLM(provider, messages, options) as unknown as LLMResponse;
  }

  if (provider === 'groq') {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: model || 'openai/gpt-oss-120b',
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      usage: toUsage(completion.usage),
    };
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: messages as any,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    usage: toUsage(completion.usage),
  };
}

/**
 * Call an LLM for a streaming chat completion.
 * Returns the provider's raw stream (AsyncIterable).
 */
export async function streamLLM(
  provider: Provider,
  messages: Message[],
  options: LLMOptions = {}
): Promise<AsyncIterable<any>> {
  const { model, temperature = 0.3, maxTokens = 2000 } = options;

  if (provider === 'groq') {
    const groq = getGroq();
    return groq.chat.completions.create({
      model: model || 'openai/gpt-oss-120b',
      messages: messages as any,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }) as any;
  }

  const openai = getOpenAI();
  return openai.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: messages as any,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  }) as any;
}