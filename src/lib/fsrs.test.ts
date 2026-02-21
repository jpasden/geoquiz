import { describe, it, expect } from 'vitest';
import {
  createEmptyCard,
  scheduleCard,
  retrievability,
  qualityToRating,
} from './fsrs';

describe('fsrs', () => {
  describe('createEmptyCard', () => {
    it('creates a new card with correct initial values', () => {
      const card = createEmptyCard('us-region-ca', 'us');

      expect(card.id).toBe('us-region-ca');
      expect(card.focus).toBe('us');
      expect(card.state).toBe('new');
      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.nextReview).toBe(0);
      expect(card.lastSeen).toBe(0);
    });
  });

  describe('scheduleCard', () => {
    const fixedNow = 1700000000000; // Fixed timestamp for deterministic tests

    it('initializes stability and difficulty on first review', () => {
      const card = createEmptyCard('us-region-ca', 'us');
      const { card: updated, interval } = scheduleCard(card, 3, fixedNow);

      expect(updated.state).toBe('review');
      expect(updated.stability).toBeGreaterThan(0);
      expect(updated.difficulty).toBeGreaterThan(0);
      expect(updated.reps).toBe(1);
      expect(updated.lastSeen).toBe(fixedNow);
      expect(updated.nextReview).toBeGreaterThan(fixedNow);
      expect(interval).toBeGreaterThanOrEqual(1);
    });

    it('moves to learning state on first "Again" rating', () => {
      const card = createEmptyCard('us-region-ca', 'us');
      const { card: updated } = scheduleCard(card, 1, fixedNow);

      expect(updated.state).toBe('learning');
      expect(updated.reps).toBe(1);
    });

    it('returns interval of 1 for "Again" rating', () => {
      const card = createEmptyCard('us-region-ca', 'us');
      const { interval } = scheduleCard(card, 1, fixedNow);

      expect(interval).toBe(1);
    });

    it('increases interval with repeated successful reviews', () => {
      let card = createEmptyCard('us-region-ca', 'us');
      let now = fixedNow;

      // First review - Good
      const result1 = scheduleCard(card, 3, now);
      card = result1.card;
      const interval1 = result1.interval;

      // Simulate time passing
      now += interval1 * 86_400_000;

      // Second review - Good
      const result2 = scheduleCard(card, 3, now);
      const interval2 = result2.interval;

      expect(interval2).toBeGreaterThan(interval1);
    });

    it('handles Easy rating with higher stability growth', () => {
      const card = createEmptyCard('us-region-ca', 'us');

      const { card: goodCard, interval: goodInterval } = scheduleCard(card, 3, fixedNow);
      const { card: easyCard, interval: easyInterval } = scheduleCard(card, 4, fixedNow);

      expect(easyCard.stability).toBeGreaterThan(goodCard.stability);
      expect(easyInterval).toBeGreaterThanOrEqual(goodInterval);
    });

    it('tracks lapses when forgetting after review state', () => {
      let card = createEmptyCard('us-region-ca', 'us');
      let now = fixedNow;

      // First review
      card = scheduleCard(card, 3, now).card;
      expect(card.lapses).toBe(0);

      // Time passes
      now += 10 * 86_400_000;

      // Forget
      card = scheduleCard(card, 1, now).card;
      expect(card.lapses).toBe(1);
      expect(card.state).toBe('relearning');
    });
  });

  describe('retrievability', () => {
    it('returns 1 for zero elapsed time', () => {
      const r = retrievability(0, 10);
      expect(r).toBeCloseTo(1, 5);
    });

    it('returns approximately 0.9 when elapsed equals stability', () => {
      // At t=S, retrievability should be close to 0.9 (target retention)
      const stability = 10;
      const r = retrievability(stability, stability);
      expect(r).toBeCloseTo(0.9, 1);
    });

    it('decreases as time passes', () => {
      const stability = 10;
      const r1 = retrievability(1, stability);
      const r5 = retrievability(5, stability);
      const r10 = retrievability(10, stability);

      expect(r1).toBeGreaterThan(r5);
      expect(r5).toBeGreaterThan(r10);
    });
  });

  describe('qualityToRating', () => {
    it('maps 0-1 to Again (1)', () => {
      expect(qualityToRating(0)).toBe(1);
      expect(qualityToRating(1)).toBe(1);
    });

    it('maps 2 to Hard (2)', () => {
      expect(qualityToRating(2)).toBe(2);
    });

    it('maps 3-4 to Good (3)', () => {
      expect(qualityToRating(3)).toBe(3);
      expect(qualityToRating(4)).toBe(3);
    });

    it('maps 5 to Easy (4)', () => {
      expect(qualityToRating(5)).toBe(4);
    });
  });
});
