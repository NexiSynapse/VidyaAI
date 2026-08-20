/**
 * In-memory chat history store for the P0 prototype.
 *
 * P0 scope: a single hardcoded demo user, no auth. We keep recent sessions in
 * a module-level Map keyed by sessionId. This is per-server-instance memory
 * (fine for a hackathon demo). Swap for a DB-backed store in P1/P2 when real
 * users and persistence are needed.
 */

export interface ChatMessageRecord {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  messages: ChatMessageRecord[];
  updatedAt: number;
}

const sessions = new Map<string, Session>();

const MAX_MESSAGES_PER_SESSION = 40;
const SESSION_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

function pruneIfStale(sessionId: string, session: Session): void {
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
  }
}

export function getChatHistory(sessionId: string): ChatMessageRecord[] {
  const session = sessions.get(sessionId);
  if (!session) return [];
  pruneIfStale(sessionId, session);
  return session ? [...session.messages] : [];
}

export function appendChatMessage(sessionId: string, message: ChatMessageRecord): void {
  const session = sessions.get(sessionId) ?? { messages: [], updatedAt: Date.now() };
  session.messages.push(message);
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
  }
  session.updatedAt = Date.now();
  sessions.set(sessionId, session);
}
