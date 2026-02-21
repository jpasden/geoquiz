import { getDB } from './geoDB';
import type { QuizSession, SessionScope } from '../types/geo';

export async function saveSession(session: QuizSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSession(id: string): Promise<QuizSession | undefined> {
  const db = await getDB();
  return db.get('sessions', id);
}

export async function getSessionsByScope(scope: SessionScope): Promise<QuizSession[]> {
  const db = await getDB();
  return db.getAllFromIndex('sessions', 'by_scope', scope);
}

export async function getRecentSessions(limit = 20): Promise<QuizSession[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'by_startedAt');
  return all.slice(-limit).reverse();
}

export async function deleteAllSessions(): Promise<void> {
  const db = await getDB();
  await db.clear('sessions');
}
