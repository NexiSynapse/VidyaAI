import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { embedQuery, retrieveChunks } from '@/lib/retrieval';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

interface QuizGenerateRequest {
  documentId?: string;
  topic?: string;
  count?: number;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizGenerateResponse {
  quizId: string;
  questions: QuizQuestion[];
}

export async function POST(request: NextRequest) {
  try {
    const body: QuizGenerateRequest = await request.json();
    const { documentId, topic, count = 5 } = body;

    if (!documentId && !topic) {
      return NextResponse.json(
        { error: 'Either documentId or topic is required' },
        { status: 400 }
      );
    }

    // Retrieve chunks for quiz generation
    let chunks: Array<{ id: string; document_id: string; content: string; page?: number; section?: string }> = [];
    if (documentId) {
      // Get all chunks for the document
      const { data, error } = await supabaseAdmin
        .from('chunks')
        .select('id, document_id, content, page, section')
        .eq('document_id', documentId)
        .limit(20);

      if (error) throw error;
      chunks = data || [];
    } else if (topic) {
      // Get chunks by topic
      const { data, error } = await supabaseAdmin
        .from('chunks')
        .select('id, document_id, content, page, section')
        .eq('topic', topic)
        .limit(20);

      if (error) throw error;
      chunks = data || [];
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No content found to generate quiz from' },
        { status: 404 }
      );
    }

    // Combine chunk content
    const context = chunks.map((chunk, i) => 
      `[Source ${i + 1}]${chunk.page ? ` (page ${chunk.page})` : ''}${chunk.section ? ` - ${chunk.section}` : ''}:\n${chunk.content}`
    ).join('\n\n---\n\n');

    // Generate quiz using LLM with structured output
    const systemPrompt = `You are an AI study teacher creating a multiple-choice quiz from the student's course material.

Generate exactly ${count} questions. Each question must:
1. Be based ONLY on the provided context
2. Have 4 options (A, B, C, D)
3. Have exactly one correct answer
4. Include a clear explanation of why the answer is correct
5. Test understanding, not just memorization

Return as JSON only with this exact structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct and others are not"
    }
  ]
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Context:\n${context}\n\nGenerate ${count} quiz questions.` },
    ];

    let quizData: { questions: QuizQuestion[] };
    
    try {
      // Try with Groq first
      const result = await callLLM('groq', messages, {
        temperature: 0.3,
        maxTokens: 3000,
      });
      
      const parsed = JSON.parse(result.content);
      quizData = parsed;
    } catch (groqError) {
      console.warn('Groq failed for quiz generation, falling back to OpenAI:', groqError);
      const result = await callLLM('openai', messages, {
        temperature: 0.3,
        maxTokens: 3000,
      });
      
      const parsed = JSON.parse(result.content);
      quizData = parsed;
    }

    // Validate and format questions
    const questions: QuizQuestion[] = quizData.questions.slice(0, count).map((q, i) => ({
      id: `q_${Date.now()}_${i}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));

    // Store quiz in database
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .insert({
        document_id: documentId,
        topic: topic || 'general',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (quizError) throw quizError;

    // Store questions
    const questionRecords = questions.map(q => ({
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