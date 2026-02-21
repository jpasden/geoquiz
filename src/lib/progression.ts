import type { Difficulty, Focus, GeoCard } from '../types/geo';

/** Thresholds for unlocking higher difficulty levels */
const UNLOCK_THRESHOLDS: Record<Difficulty, number> = {
  1: 0,   // Level 1 unlocked by default
  2: 5,   // Unlock level 2 after mastering 5 items
  3: 15,  // Unlock level 3 after mastering 15 items
  4: 30,  // Unlock level 4 after mastering 30 items
  5: 50,  // Unlock level 5 after mastering 50 items
};

/** Minimum stability to consider an item "mastered" */
const MASTERY_STABILITY_THRESHOLD = 21; // ~3 weeks stability

/**
 * Check if a card is considered "mastered"
 * A card is mastered when it has sufficient stability (long review interval)
 */
export function isMastered(card: GeoCard): boolean {
  return card.state === 'review' && card.stability >= MASTERY_STABILITY_THRESHOLD;
}

/**
 * Calculate the unlocked difficulty level based on mastered item count
 */
export function calculateUnlockedDifficulty(masteredCount: number): Difficulty {
  if (masteredCount >= UNLOCK_THRESHOLDS[5]) return 5;
  if (masteredCount >= UNLOCK_THRESHOLDS[4]) return 4;
  if (masteredCount >= UNLOCK_THRESHOLDS[3]) return 3;
  if (masteredCount >= UNLOCK_THRESHOLDS[2]) return 2;
  return 1;
}

/**
 * Count mastered items from a list of cards
 */
export function countMastered(cards: GeoCard[]): number {
  return cards.filter(isMastered).length;
}

/**
 * Get the number of items needed to unlock the next difficulty level
 */
export function itemsToNextLevel(masteredCount: number): { nextLevel: Difficulty; needed: number } | null {
  const currentLevel = calculateUnlockedDifficulty(masteredCount);
  if (currentLevel >= 5) return null;

  const nextLevel = (currentLevel + 1) as Difficulty;
  const needed = UNLOCK_THRESHOLDS[nextLevel] - masteredCount;
  return { nextLevel, needed };
}

export interface UserProgress {
  focus: Focus;
  unlockedDifficulty: Difficulty;
  masteredCount: number;
  updatedAt: number;
}

/**
 * Create initial progress for a focus
 */
export function createInitialProgress(focus: Focus): UserProgress {
  return {
    focus,
    unlockedDifficulty: 1,
    masteredCount: 0,
    updatedAt: Date.now(),
  };
}
