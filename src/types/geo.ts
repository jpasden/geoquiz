// ─── Core enums ────────────────────────────────────────────────────────────

export type Focus = 'us' | 'world' | 'europe';

export type SessionScope = Focus | 'all';

/** Static difficulty rating: 1=easiest (famous/large), 5=hardest (obscure/small) */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

// ─── GeoItem ───────────────────────────────────────────────────────────────

/** A single quizzable geographic item (region: state, country, or province). */
export interface GeoItem {
  /** e.g. "us-region-ca", "china-region-chn-1756", "europe-region-fra" */
  id: string;
  focus: Focus;
  /** English canonical name */
  nameEn: string;
  /** Chinese translation (e.g. "加利福尼亚" for California) */
  nameZh?: string;
  /** Country/territory flag emoji (e.g. "🇫🇷" for France) */
  flagEmoji?: string;
  /** Alternate spellings for fuzzy match (may include pinyin for CN) */
  aliases: string[];
  /** Static difficulty: 1=easy (famous), 5=hard (obscure) */
  difficulty: Difficulty;
}

// ─── FSRS Card ─────────────────────────────────────────────────────────────

export type FSRSState = 'new' | 'learning' | 'review' | 'relearning';

/** FSRS-based SRS card stored in IndexedDB. */
export interface GeoCard {
  /** matches GeoItem.id */
  id: string;
  focus: Focus;
  state: FSRSState;
  /** FSRS stability (days; how long until 90% retention) */
  stability: number;
  /** FSRS difficulty (1–10) */
  difficulty: number;
  /** Elapsed days since last review */
  elapsedDays: number;
  /** Scheduled interval in days */
  scheduledDays: number;
  /** Total review count */
  reps: number;
  /** Times forgotten/failed */
  lapses: number;
  /** Unix timestamp (ms) for next due date */
  nextReview: number;
  /** Unix timestamp (ms) of last review */
  lastSeen: number;
}

// ─── Quiz Session ──────────────────────────────────────────────────────────

/** Rating given by the user during a quiz answer. Maps to FSRS grades. */
export type AnswerRating = 1 | 2 | 3 | 4;
// 1 = Again (forgotten), 2 = Hard, 3 = Good, 4 = Easy

export interface QuizResult {
  itemId: string;
  correct: boolean;
  responseTimeMs: number;
  attempt: string;
  /** FSRS rating: 1=Again, 2=Hard, 3=Good, 4=Easy */
  rating: AnswerRating;
}

export interface QuizSession {
  id: string;
  startedAt: number;
  scope: SessionScope;
  sessionSize: 10 | 'all';
  queue: string[];
  results: QuizResult[];
  completed: boolean;
}

// ─── User Progress ─────────────────────────────────────────────────────────

/** Tracks user progression and unlocked difficulty levels per focus. */
export interface UserProgress {
  focus: Focus;
  /** Current unlock level (1-5, starts at 1) */
  unlockedDifficulty: Difficulty;
  /** Total items mastered (state='review' with stability >= 7 days) */
  masteredCount: number;
  /** Last updated timestamp */
  updatedAt: number;
}

// ─── App Settings ──────────────────────────────────────────────────────────

export interface AppSettings {
  progressView: 'map' | 'list';
}
