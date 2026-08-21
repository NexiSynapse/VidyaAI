const API_BASE = '/api';

export interface ApiDocument {
  id: string;
  title: string;
  topic: string | null;
  topic_id: string | null;
  status: string;
  storage_path: string | null;
  user_id: string | null;
  created_at: string;
}

export interface ApiTopic {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ApiSearchResult {
  id: string;
  content: string;
  document_id: string;
  topic_id: string | null;
  similarity: number;
}

export interface ApiQuiz {
  id: string;
  title: string;
  document_id: string;
  topic_id: string | null;
  created_at: string;
  questions?: ApiQuizQuestion[];
}

export interface ApiQuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  type: string;
}

export interface ApiQuizAttempt {
  quiz_id: string;
  score: number;
  results: { questionId: string; isCorrect: boolean; explanation: string }[];
}

export interface ApiAttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  answers: unknown;
  created_at: string;
  quizzes?: {
    title: string;
    topic_id: string | null;
    topics?: { name: string } | null;
  } | null;
}

export interface ApiProgress {
  id: string;
  user_id: string;
  topic_id: string;
  mastery_score: number;
  last_updated: string;
  topics?: { name: string };
}

export interface ApiFlashcard {
  id: string;
  question: string;
  answer: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  topic_name: string | null;
}

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export function getDemoUserId(): string {
  return DEMO_USER_ID;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Documents
export async function fetchDocuments(): Promise<ApiDocument[]> {
  return request<ApiDocument[]>('/documents');
}

export async function deleteDocument(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' });
}

export async function uploadDocument(file: File, topicId?: string): Promise<{ success: boolean; chunksCount: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (topicId) formData.append('topicId', topicId);

  const res = await fetch(`${API_BASE}/ingest`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// Topics
export async function fetchTopics(): Promise<ApiTopic[]> {
  return request<ApiTopic[]>('/topics');
}

export async function createTopic(name: string, description?: string): Promise<ApiTopic> {
  return request<ApiTopic>('/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
}

// Search (RAG)
export async function searchChunks(query: string, documentId?: string): Promise<{ chunks: ApiSearchResult[] }> {
  return request<{ chunks: ApiSearchResult[] }>('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, documentId }),
  });
}

// Quizzes
export async function fetchQuizzes(): Promise<ApiQuiz[]> {
  return request<ApiQuiz[]>('/quizzes');
}

export async function createQuiz(documentId: string, title: string, questions: { question: string; options: string[]; correct_answer: string; explanation: string }[], topicId?: string): Promise<{ id: string; title: string }> {
  return request<{ id: string; title: string }>('/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, topicId, title, questions }),
  });
}

export async function fetchQuiz(id: string): Promise<ApiQuiz> {
  return request<ApiQuiz>(`/quizzes/${id}`);
}

export async function submitQuiz(quizId: string, answers: { questionId: string; answer: string }[]): Promise<ApiQuizAttempt> {
  return request<ApiQuizAttempt>('/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId, userId: DEMO_USER_ID, answers }),
  });
}

// Progress
export async function fetchProgress(): Promise<ApiProgress[]> {
  return request<ApiProgress[]>(`/progress/${DEMO_USER_ID}`);
}

// Attempts
export async function fetchAttempts(): Promise<ApiAttemptRow[]> {
  return request<ApiAttemptRow[]>(`/attempts/${DEMO_USER_ID}`);
}

// Flashcards
export async function fetchDueFlashcards(): Promise<ApiFlashcard[]> {
  return request<ApiFlashcard[]>(`/flashcards/due?userId=${DEMO_USER_ID}`);
}

export async function reviewFlashcard(cardId: string, quality: number): Promise<{ nextReviewDate: string; card: ApiFlashcard }> {
  return request<{ nextReviewDate: string; card: ApiFlashcard }>('/flashcards/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, userId: DEMO_USER_ID, quality }),
  });
}
