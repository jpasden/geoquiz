import { getDB } from './geoDB';
import type { Focus, UserProgress } from '../types/geo';
import { createInitialProgress } from '../lib/progression';

/**
 * Get user progress for a specific focus
 */
export async function getProgress(focus: Focus): Promise<UserProgress> {
  const db = await getDB();
  const existing = await db.get('user_progress', focus);
  return existing ?? createInitialProgress(focus);
}

/**
 * Get progress for all focuses
 */
export async function getAllProgress(): Promise<UserProgress[]> {
  const db = await getDB();
  const all = await db.getAll('user_progress');

  // Fill in defaults for any missing focuses
  const focuses: Focus[] = ['us', 'world', 'europe'];
  const byFocus = new Map(all.map(p => [p.focus, p]));

  return focuses.map(f => byFocus.get(f) ?? createInitialProgress(f));
}

/**
 * Save user progress for a focus
 */
export async function saveProgress(progress: UserProgress): Promise<void> {
  const db = await getDB();
  await db.put('user_progress', progress);
}

/**
 * Update progress after quiz session completes
 * Recalculates mastered count and unlocked difficulty
 */
export async function updateProgressForFocus(
  focus: Focus,
  masteredCount: number,
  unlockedDifficulty: 1 | 2 | 3 | 4 | 5,
): Promise<UserProgress> {
  const progress: UserProgress = {
    focus,
    masteredCount,
    unlockedDifficulty,
    updatedAt: Date.now(),
  };
  await saveProgress(progress);
  return progress;
}

/**
 * Delete all user progress (reset to defaults)
 */
export async function deleteAllProgress(): Promise<void> {
  const db = await getDB();
  await db.clear('user_progress');
}
