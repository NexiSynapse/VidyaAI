import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

interface ProgressResponse {
  topic: string;
  mastery: number;
  attempts: number;
  lastAttempt?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';

    // Get all quiz attempts for this user with quiz topics
    const { data: attempts, error } = await supabaseAdmin
      .from('quiz_attempts')
      .select(`
        score,
        created_at,
        quizzes!inner (
          topic,
          document_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!attempts || attempts.length === 0) {
      return NextResponse.json<ProgressResponse[]>([]);
    }

    // Group by topic and calculate mastery
    const topicMap = new Map<string, { scores: number[]; lastAttempt: string; attempts: number }>();

    for (const attempt of attempts) {
      const topic = (attempt.quizzes as any)?.topic || 'general';
      const existing = topicMap.get(topic) || { scores: [], lastAttempt: '', attempts: 0 };
      
      existing.scores.push(attempt.score);
      existing.lastAttempt = attempt.created_at;
      existing.attempts++;
      
      topicMap.set(topic, existing);
    }

    // Calculate mastery for each topic (weighted average of last N attempts)
    const progress: ProgressResponse[] = Array.from(topicMap.entries()).map(([topic, data]) => {
      // Weight recent attempts more heavily
      const weights = data.scores.map((_, i) => Math.pow(1.1, i - data.scores.length + 1));
      const weightedSum = data.scores.reduce((sum, score, i) => sum + score * weights[i], 0);
      const weightSum = weights.reduce((sum, w) => sum + w, 0);
      const mastery = weightSum > 0 ? weightedSum / weightSum : 0;

      return {
        topic,
        mastery: Math.round(mastery),
        attempts: data.attempts,
        lastAttempt: data.lastAttempt,
      };
    });

    return NextResponse.json<ProgressResponse[]>(progress);
  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}