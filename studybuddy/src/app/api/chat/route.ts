import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { embedQuery, retrieveChunks, buildRAGPrompt, Citation } from '@/lib/retrieval';
import { getChatHistory, appendChatMessage } from '@/lib/chatHistory';

export const runtime = 'nodejs';

interface ChatRequest {
  documentId?: string;
  topic?: string;
  message: string;
  history?: { role: string; content: string }[];
  sessionId?: string;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
  sessionId: string;
}

const NOT_FOUND_MESSAGE =
  "I couldn't find relevant information in your uploaded materials to answer this question. Try uploading more documents or rephrasing your question.";

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { documentId, topic, message, history = [], sessionId } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Prefer an explicit history; fall back to the server-side session store.
    const effectiveSessionId =
      sessionId || `demo-${Math.random().toString(36).slice(2)}`;
    const priorHistory =
      history.length > 0 ? history : getChatHistory(effectiveSessionId);

    // Embed the query and retrieve relevant chunks.
    const queryEmbedding = await embedQuery(message);
    const chunks = await retrieveChunks(queryEmbedding, {
      documentId,
      topic,
      topK: 5,
      similarityThreshold: 0.65,
    });

    // "Not found" fallback when nothing relevant is retrieved.
    if (chunks.length === 0) {
      appendChatMessage(effectiveSessionId, { role: 'user', content: message });
      appendChatMessage(effectiveSessionId, { role: 'assistant', content: NOT_FOUND_MESSAGE });
      return NextResponse.json<ChatResponse>({
        answer: NOT_FOUND_MESSAGE,
        citations: [],
        sessionId: effectiveSessionId,
      });
    }

    // Build the grounded prompt + citations.
    const { messages, citations } = buildRAGPrompt(message, chunks, priorHistory);

    // Call the LLM (Groq for speed, OpenAI as fallback).
    let response: string;
    try {
      const result = await callLLM('groq', messages, {
        temperature: 0.3,
        maxTokens: 2000,
      });
      response = result.content;
    } catch (groqError) {
      console.warn('Groq failed, falling back to OpenAI:', groqError);
      const result = await callLLM('openai', messages, {
        temperature: 0.3,
        maxTokens: 2000,
      });
      response = result.content;
    }

    // Persist the turn so future messages have context.
    appendChatMessage(effectiveSessionId, { role: 'user', content: message });
    appendChatMessage(effectiveSessionId, { role: 'assistant', content: response });

    return NextResponse.json<ChatResponse>({
      answer: response,
      citations,
      sessionId: effectiveSessionId,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
