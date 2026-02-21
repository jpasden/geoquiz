import { describe, it, expect } from 'vitest';
import {
  isMastered,
  calculateUnlockedDifficulty,
  countMastered,
  itemsToNextLevel,
  createInitialProgress,
} from './progression';
import type { GeoCard } from '../types/geo';

function makeCard(overrides: Partial<GeoCard> = {}): GeoCard {
  return {
    id: 'test-card',
    focus: 'us',
    state: 'new',
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    nextReview: 0,
    lastSeen: 0,
    ...overrides,
  };
}

describe('progression', () => {
  describe('isMastered', () => {
    it('returns false for new cards', () => {
      const card = makeCard({ state: 'new', stability: 0 });
      expect(isMastered(card)).toBe(false);
    });

    it('returns false for learning cards', () => {
      const card = makeCard({ state: 'learning', stability: 10 });
      expect(isMastered(card)).toBe(false);
    });

    it('returns false for review cards with low stability', () => {
      const card = makeCard({ state: 'review', stability: 10 });
      expect(isMastered(card)).toBe(false);
    });

    it('returns true for review cards with stability >= 21', () => {
      const card = makeCard({ state: 'review', stability: 21 });
      expect(isMastered(card)).toBe(true);
    });

    it('returns true for review cards with high stability', () => {
      const card = makeCard({ state: 'review', stability: 100 });
      expect(isMastered(card)).toBe(true);
    });
  });

  describe('calculateUnlockedDifficulty', () => {
    it('returns 1 for 0 mastered items', () => {
      expect(calculateUnlockedDifficulty(0)).toBe(1);
    });

    it('returns 1 for 4 mastered items', () => {
      expect(calculateUnlockedDifficulty(4)).toBe(1);
    });

    it('returns 2 for 5 mastered items', () => {
      expect(calculateUnlockedDifficulty(5)).toBe(2);
    });

    it('returns 2 for 14 mastered items', () => {
      expect(calculateUnlockedDifficulty(14)).toBe(2);
    });

    it('returns 3 for 15 mastered items', () => {
      expect(calculateUnlockedDifficulty(15)).toBe(3);
    });

    it('returns 4 for 30 mastered items', () => {
      expect(calculateUnlockedDifficulty(30)).toBe(4);
    });

    it('returns 5 for 50 mastered items', () => {
      expect(calculateUnlockedDifficulty(50)).toBe(5);
    });

    it('returns 5 for 100 mastered items', () => {
      expect(calculateUnlockedDifficulty(100)).toBe(5);
    });
  });

  describe('countMastered', () => {
    it('returns 0 for empty array', () => {
      expect(countMastered([])).toBe(0);
    });

    it('returns 0 when no cards are mastered', () => {
      const cards = [
        makeCard({ state: 'new' }),
        makeCard({ state: 'learning', stability: 5 }),
        makeCard({ state: 'review', stability: 10 }),
      ];
      expect(countMastered(cards)).toBe(0);
    });

    it('counts only mastered cards', () => {
      const cards = [
        makeCard({ state: 'review', stability: 21 }),
        makeCard({ state: 'review', stability: 10 }),
        makeCard({ state: 'review', stability: 50 }),
        makeCard({ state: 'learning', stability: 30 }),
      ];
      expect(countMastered(cards)).toBe(2);
    });
  });

  describe('itemsToNextLevel', () => {
    it('returns items needed for level 2 when at 0', () => {
      const result = itemsToNextLevel(0);
      expect(result).toEqual({ nextLevel: 2, needed: 5 });
    });

    it('returns items needed for level 2 when at 3', () => {
      const result = itemsToNextLevel(3);
      expect(result).toEqual({ nextLevel: 2, needed: 2 });
    });

    it('returns items needed for level 3 when at 10', () => {
      const result = itemsToNextLevel(10);
      expect(result).toEqual({ nextLevel: 3, needed: 5 });
    });

    it('returns null when at max level', () => {
      const result = itemsToNextLevel(50);
      expect(result).toBeNull();
    });

    it('returns null when above max threshold', () => {
      const result = itemsToNextLevel(100);
      expect(result).toBeNull();
    });
  });

  describe('createInitialProgress', () => {
    it('creates progress with correct defaults', () => {
      const progress = createInitialProgress('us');
      expect(progress.focus).toBe('us');
      expect(progress.unlockedDifficulty).toBe(1);
      expect(progress.masteredCount).toBe(0);
      expect(progress.updatedAt).toBeGreaterThan(0);
    });

    it('creates progress for different focuses', () => {
      const worldProgress = createInitialProgress('world');
      const europeProgress = createInitialProgress('europe');

      expect(worldProgress.focus).toBe('world');
      expect(europeProgress.focus).toBe('europe');
    });
  });
});
