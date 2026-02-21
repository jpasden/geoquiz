/**
 * FSRS-5 implementation for GeoQuiz.
 *
 * Based on the Free Spaced Repetition Scheduler algorithm (FSRS v5).
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * Ratings:
 *   1 = Again (forgotten)
 *   2 = Hard
 *   3 = Good
 *   4 = Easy
 */

import type { GeoCard, FSRSState, AnswerRating } from '../types/geo';

// ─── Default FSRS-5 parameters (w0..w20) ──────────────────────────────────

const DEFAULT_W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589,
  1.506,  0.1544, 1.004,  1.9395,  0.11,   0.29,   2.2703, 0.2407,
  2.9466, 0.5034, 0.3567, 0.1,     0.0,
] as const;

const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 19/81 for 90% retention

/** Request retention: probability of recall we target (0.9 = 90%) */
const REQUEST_RETENTION = 0.9;

const MIN_DIFFICULTY = 1.0;
const MAX_DIFFICULTY = 10.0;

// ─── Core FSRS formulas ───────────────────────────────────────────────────

/** Forgetting curve: R(t, S) = (1 + factor * t / S) ^ decay */
export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Interval (in days) at which R = requestRetention, given stability S */
function nextInterval(stability: number): number {
  const interval = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}

/** Initial difficulty when rating the first time */
function initialDifficulty(rating: AnswerRating): number {
  const d = DEFAULT_W[4] - Math.exp(DEFAULT_W[5] * (rating - 1)) + 1;
  return clampDifficulty(d);
}

/** Initial stability after first review */
function initialStability(rating: AnswerRating): number {
  return Math.max(DEFAULT_W[rating - 1], 0.1);
}

/** Short-term stability after same-day review */
function shortTermStability(stability: number, rating: AnswerRating): number {
  return stability * Math.exp(DEFAULT_W[17] * (rating - 3 + DEFAULT_W[18]));
}

/** Mean reversion toward target difficulty */
function meanReversionDifficulty(d: number, rating: AnswerRating): number {
  const targetD = initialDifficulty(3); // "Good" anchors the mean
  const newD = d - DEFAULT_W[6] * (rating - 3) + DEFAULT_W[7] * (targetD - d);
  return clampDifficulty(newD);
}

/** Stability after a successful recall (grades 2–4) */
function recallStability(
  d: number,
  s: number,
  r: number,
  rating: AnswerRating,
): number {
  const hardPenalty = rating === 2 ? DEFAULT_W[15] : 1;
  const easyBonus = rating === 4 ? DEFAULT_W[16] : 1;
  const newS =
    s *
    (Math.exp(DEFAULT_W[8]) *
      (11 - d) *
      Math.pow(s, -DEFAULT_W[9]) *
      (Math.exp((1 - r) * DEFAULT_W[10]) - 1) *
      hardPenalty *
      easyBonus +
      1);
  return Math.max(newS, 0.1);
}

/** Stability after forgetting (grade 1) */
function forgetStability(d: number, s: number, r: number): number {
  return Math.max(
    DEFAULT_W[11] *
      Math.pow(d, -DEFAULT_W[12]) *
      (Math.pow(s + 1, DEFAULT_W[13]) - 1) *
      Math.exp((1 - r) * DEFAULT_W[14]),
    0.1,
  );
}

function clampDifficulty(d: number): number {
  return Math.min(Math.max(d, MIN_DIFFICULTY), MAX_DIFFICULTY);
}

// ─── Card creation ────────────────────────────────────────────────────────

/** Create a brand-new stub card (unseen item). */
export function createEmptyCard(
  id: string,
  focus: GeoCard['focus'],
): GeoCard {
  return {
    id,
    focus,
    state: 'new',
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    nextReview: 0,
    lastSeen: 0,
  };
}

// ─── Scheduling ───────────────────────────────────────────────────────────

export interface ScheduleResult {
  card: GeoCard;
  /** Interval in days until next review */
  interval: number;
}

/**
 * Apply a rating to a card and return the updated card + scheduled interval.
 * @param card  The card being reviewed
 * @param rating  1=Again, 2=Hard, 3=Good, 4=Easy
 * @param now  Current timestamp in ms (defaults to Date.now())
 */
export function scheduleCard(
  card: GeoCard,
  rating: AnswerRating,
  now: number = Date.now(),
): ScheduleResult {
  const lastSeen = card.lastSeen || now;
  const elapsedDays = Math.max(0, (now - lastSeen) / 86_400_000);

  let { stability, difficulty, reps, lapses } = card;
  let state: FSRSState = card.state;

  if (state === 'new') {
    // First review: initialize stability and difficulty from rating
    stability = initialStability(rating);
    difficulty = initialDifficulty(rating);
    state = rating === 1 ? 'learning' : 'review';
    reps = 1;
  } else {
    // Subsequent reviews
    const r = retrievability(elapsedDays, stability);

    if (elapsedDays < 1) {
      // Same-day review: short-term stability adjustment
      stability = shortTermStability(stability, rating);
    } else if (rating === 1) {
      // Forgotten: enter relearning
      stability = forgetStability(difficulty, stability, r);
      difficulty = meanReversionDifficulty(difficulty, rating);
      state = 'relearning';
      lapses += 1;
      reps += 1;
    } else {
      // Recalled: update stability and difficulty
      stability = recallStability(difficulty, stability, r, rating);
      difficulty = meanReversionDifficulty(difficulty, rating);
      state = 'review';
      reps += 1;
    }
  }

  const interval = rating === 1 ? 1 : nextInterval(stability);
  const nextReview = now + interval * 86_400_000;

  const updatedCard: GeoCard = {
    ...card,
    state,
    stability,
    difficulty,
    elapsedDays,
    scheduledDays: interval,
    reps,
    lapses,
    nextReview,
    lastSeen: now,
  };

  return { card: updatedCard, interval };
}

/**
 * Convert a legacy SM-2 style quality score (0–5) to FSRS rating (1–4).
 * Used for compatibility with any quiz scoring that still uses q values.
 */
export function qualityToRating(quality: 0 | 1 | 2 | 3 | 4 | 5): AnswerRating {
  if (quality <= 1) return 1; // Again
  if (quality === 2) return 2; // Hard
  if (quality <= 4) return 3; // Good
  return 4; // Easy
}
