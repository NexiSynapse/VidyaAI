import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

interface QuizSubmitRequest {
  quizId: string;
  answers: number[];  // Array of selected option indices
  userId?: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  results: {
    questionId: string;
    correct: boolean;
    selectedAnswer: number;
    correctAnswer: number;
    explanation: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const body: QuizSubmitRequest = await request.json();
    const { quizId, answers, userId } = body;

    if (!quizId || !answers) {
      return NextResponse.json(
        { error: 'quizId and answers are required' },
        { status: 400 }
      );
    }

    // Get questions for this quiz
    const { data: questions, error } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, correct_answer, explanation')
      .eq('quiz_id', quizId);

    if (error) throw error;
    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      );
    }

    // Calculate score
    let correctCount = 0;
    const results: QuizResult['results'] = [];

    questions.forEach((q: { id: string; correct_answer: number; explanation: string }, i: number) => {
      const selected = answers[i];
      const correct = selected === q.correct_answer;
      if (correct) correctCount++;

      results.push({
        questionId: q.id,
        correct,
        selectedAnswer: selected,
        correctAnswer: q.correct_answer,
        explanation: q.explanation,
      });
    });

    const score = (correctCount / questions.length) * 100;
    const percentage = Math.round(score);

    // Store attempt
    const { error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        user_id: userId || 'demo-user',
        score: score,
        answers: answers,
        created_at: new Date().toISOString(),
      });

    if (attemptError) throw attemptError;

    return NextResponse.json<QuizResult>({
      score: score,
      totalQuestions: questions.length,
      percentage,
      results,
    });
  } catch (error) {
    console.error('Quiz submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}