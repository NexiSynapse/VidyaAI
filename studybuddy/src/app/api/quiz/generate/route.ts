import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

export const runtime = 'nodejs';

interface QuizGenerateRequest {
  documentId?: string;
  topic?: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty?: string;
}

interface QuizGenerateResponse {
  quizId: string;
  questions: QuizQuestion[];
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const SYSTEM_PROMPT_TEMPLATE = `You are an AI study teacher creating a multiple-choice quiz from the student's course material.

Generate exactly {COUNT} questions at {DIFFICULTY} difficulty. Each question must:
1. Be based ONLY on the provided context
2. Have 4 options (A, B, C, D)
3. Have exactly one correct answer (index 0-3)
4. Include a clear explanation of why the answer is correct
5. Test understanding, not just memorization
6. Vary question types: conceptual, application, and analysis

Return valid JSON with this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this is correct"
    }
  ]
}`;

function parseQuizJSON(content: string, count: number): { questions: QuizQuestion[] } | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return null;
    }
    for (const q of parsed.questions) {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        return null;
      }
      if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        return null;
      }
      if (!q.explanation) {
        q.explanation = 'No explanation provided.';
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractJSONFromMarkdown(content: string): string | null {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  const startIndex = content.indexOf('{');
  const lastIndex = content.lastIndexOf('}');
  if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
    return content.slice(startIndex, lastIndex + 1);
  }
  return null;
}

async function generateQuizWithOpenAIJsonMode(
  context: string,
  count: number,
  difficulty: string
): Promise<{ questions: QuizQuestion[] }> {
  const openai = getOpenAI();
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{COUNT}', String(count))
    .replace('{DIFFICULTY}', difficulty);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Context:\n${context}\n\nGenerate ${count} quiz questions as valid JSON.` },
    ],
    temperature: 0.4,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '';
  const parsed = parseQuizJSON(content, count);
  if (!parsed) {
    throw new Error('Failed to parse quiz JSON from OpenAI structured output');
  }
  return parsed;
}

async function generateQuizWithGroq(
  context: string,
  count: number,
  difficulty: string
): Promise<{ questions: QuizQuestion[] }> {
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{COUNT}', String(count))
    .replace('{DIFFICULTY}', difficulty);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `Context:\n${context}\n\nGenerate ${count} quiz questions as valid JSON. Return ONLY the JSON object, no markdown, no explanation.` },
  ];

  const result = await callLLM('groq', messages, {
    temperature: 0.4,
    maxTokens: 4000,
  });

  let content = result.content.trim();
  const extracted = extractJSONFromMarkdown(content);
  if (extracted) {
    content = extracted;
  }

  const parsed = parseQuizJSON(content, count);
  if (!parsed) {
    throw new Error('Failed to parse quiz JSON from Groq output');
  }
  return parsed;
}

async function generateQuizWithRetry(
  context: string,
  count: number,
  difficulty: string,
  maxRetries: number = 2
): Promise<{ questions: QuizQuestion[] }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        try {
          return await generateQuizWithOpenAIJsonMode(context, count, difficulty);
        } catch (openaiError) {
          console.warn('OpenAI JSON mode failed, trying Groq:', openaiError);
        }
      }

      return await generateQuizWithGroq(context, count, difficulty);
    } catch (err) {
      lastError = err as Error;
      console.warn(`Quiz generation attempt ${attempt + 1} failed:`, err);
    }
  }

  throw lastError || new Error('All quiz generation attempts failed');
}

export async function POST(request: NextRequest) {
  try {
    const body: QuizGenerateRequest = await request.json();
    const { documentId, topic, count = 5, difficulty = 'medium' } = body;

    if (!documentId && !topic) {
      return NextResponse.json(
        { error: 'Either documentId or topic is required' },
        { status: 400 }
      );
    }

    let chunks: Array<{ id: string; document_id: string; content: string; page?: number; section?: string }> = [];

    if (documentId) {
      const { data, error } = await supabaseAdmin
        .from('chunks')
        .select('id, document_id, content, page, section')
        .eq('document_id', documentId)
        .limit(25);

      if (error) throw error;
      chunks = data || [];
    } else if (topic) {
      const { data, error } = await supabaseAdmin
        .from('chunks')
        .select('id, document_id, content, page, section')
        .eq('topic', topic)
        .limit(25);

      if (error) throw error;
      chunks = data || [];
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No content found to generate quiz from. Please upload some documents first.' },
        { status: 404 }
      );
    }

    const context = chunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}]${chunk.page ? ` (page ${chunk.page})` : ''}${
            chunk.section ? ` - ${chunk.section}` : ''
          }:\n${chunk.content}`
      )
      .join('\n\n---\n\n');

    let quizData: { questions: QuizQuestion[] };

    try {
      quizData = await generateQuizWithRetry(context, count, difficulty);
    } catch (genError) {
      console.error('All quiz generation attempts failed:', genError);
      return NextResponse.json(
        { error: 'Failed to generate quiz questions. Please try again.' },
        { status: 500 }
      );
    }

    const questions: QuizQuestion[] = quizData.questions.slice(0, count).map((q, i) => ({
      id: `q_${Date.now()}_${i}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty,
    }));

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .insert({
        document_id: documentId || null,
        topic: topic || 'general',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (quizError) throw quizError;

    const questionRecords = questions.map((q) => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation,
    }));

    const { error: questionsError } = await supabaseAdmin
      .from('quiz_questions')
      .insert(questionRecords);

    if (questionsError) throw questionsError;

    return NextResponse.json<QuizGenerateResponse>({
      quizId: quiz.id,
      questions,
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}