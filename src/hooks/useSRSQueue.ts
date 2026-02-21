import { useCallback } from 'react';
import type { Focus, SessionScope, GeoCard } from '../types/geo';
import {
  getCardsByFocus,
  getExistingCardIds,
  saveCards,
} from '../db/cardOps';
import { createEmptyCard } from '../lib/fsrs';
import { getItemsByFocus, getItem } from '../lib/itemUtils';

// Items reviewed in the last hour are considered "recent" and eligible for re-review
const RECENT_REVIEW_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Build a review queue for a single focus.
 *
 * Priority order:
 * 1. Recently wrong (reviewed in last hour with state=learning/relearning)
 * 2. Due for review (nextReview <= now)
 * 3. New/unseen items (always introduce fresh material!)
 * 4. Recently reviewed but correct (extra reinforcement)
 * 5. Seen but not due yet (fill remaining slots)
 *
 * This ensures users can always study more - we never gatekeep!
 * New items come before "recently correct" so you always learn something new.
 */
async function buildSingleFocusQueue(
  focus: Focus,
  sessionSize: 10 | 'all',
): Promise<string[]> {
  const now = Date.now();
  const recentCutoff = now - RECENT_REVIEW_WINDOW_MS;

  // Get all items for this focus
  const allItems = getItemsByFocus(focus);

  const existingIds = await getExistingCardIds(focus);

  // Bootstrap unseen items lazily
  const newCards: GeoCard[] = allItems
    .filter((item) => !existingIds.has(item.id))
    .map((item) => createEmptyCard(item.id, focus));
  if (newCards.length > 0) {
    await saveCards(newCards);
  }

  // Get all cards for this focus, filtered to only known item IDs
  const validItemIds = new Set(allItems.map(item => item.id));
  const allCards = await getCardsByFocus(focus);
  const cards = allCards.filter(c => validItemIds.has(c.id));

  // Categorize cards
  const recentlyWrong: string[] = [];
  const due: string[] = [];
  const recentlyCorrect: string[] = [];
  const seenButNotDue: string[] = [];

  for (const card of cards) {
    // Skip cards in 'new' state - they're handled by newItems sorting below
    if (card.state === 'new') continue;

    const wasRecentlyReviewed = card.lastSeen >= recentCutoff;
    const isDue = card.nextReview <= now;
    const isStruggling = card.state === 'learning' || card.state === 'relearning';

    if (wasRecentlyReviewed && isStruggling) {
      // Recently got wrong - highest priority for reinforcement
      recentlyWrong.push(card.id);
    } else if (isDue) {
      // Due for review
      due.push(card.id);
    } else if (wasRecentlyReviewed) {
      // Recently reviewed and got correct - good for reinforcement
      recentlyCorrect.push(card.id);
    } else {
      // Seen before but not due yet
      seenButNotDue.push(card.id);
    }
  }

  // Shuffle function (for items within same priority tier)
  const shuffle = (arr: string[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };

  // New items (never seen or state is 'new'), grouped by difficulty (easier first),
  // but shuffled within each difficulty level for variety across sessions.
  const seenIds = new Set(cards.filter(c => c.state !== 'new').map(c => c.id));
  const unseenItems = allItems.filter(item => !seenIds.has(item.id));
  const byDifficulty = new Map<number, string[]>();
  for (const item of unseenItems) {
    const group = byDifficulty.get(item.difficulty) ?? [];
    group.push(item.id);
    byDifficulty.set(item.difficulty, group);
  }
  const newIds: string[] = [];
  for (const level of [1, 2, 3, 4, 5] as const) {
    const group = byDifficulty.get(level) ?? [];
    shuffle(group);
    newIds.push(...group);
  }

  // Shuffle lower-priority arrays for variety
  shuffle(seenButNotDue);
  shuffle(recentlyCorrect);

  // Build queue with strict priority: wrong > due > new > seen-not-due > recent correct
  // New items are sorted by difficulty (easier first) to provide natural progression
  // seenButNotDue and recentlyCorrect only fill remaining slots after new items exhausted
  let combined = [
    ...recentlyWrong,
    ...due,
    ...newIds,
    ...seenButNotDue,
    ...recentlyCorrect,
  ];

  // Remove duplicates (shouldn't happen but safety)
  combined = [...new Set(combined)];

  if (sessionSize === 10) {
    combined = combined.slice(0, 10);
  }

  return combined;
}

/**
 * Build a Review All queue (cards across all focuses).
 * Only includes items that have been seen before (no new items in Review All mode).
 * Includes recently wrong items even if not technically "due".
 */
async function buildReviewAllQueue(
  sessionSize: 10 | 'all',
): Promise<string[]> {
  const now = Date.now();
  const recentCutoff = now - RECENT_REVIEW_WINDOW_MS;

  // Gather cards from all focuses
  const focuses: Focus[] = ['us', 'world', 'europe'];
  const allCards: GeoCard[] = [];
  for (const f of focuses) {
    const cards = await getCardsByFocus(f);
    allCards.push(...cards);
  }

  // Categorize (no difficulty filtering - review all seen items)
  // Filter out stale card IDs that no longer correspond to known items
  const recentlyWrong: string[] = [];
  const due: string[] = [];
  const recentlyCorrect: string[] = [];

  for (const card of allCards) {
    // Skip cards that haven't been reviewed yet
    if (card.state === 'new') continue;
    // Skip cards whose IDs no longer map to a known item (stale from old data)
    if (!getItem(card.id)) continue;

    const wasRecentlyReviewed = card.lastSeen >= recentCutoff;
    const isDue = card.nextReview <= now;
    const isStruggling = card.state === 'learning' || card.state === 'relearning';

    if (wasRecentlyReviewed && isStruggling) {
      recentlyWrong.push(card.id);
    } else if (isDue) {
      due.push(card.id);
    } else if (wasRecentlyReviewed) {
      recentlyCorrect.push(card.id);
    }
  }

  // Priority: wrong > due > recent correct
  let combined = [...recentlyWrong, ...due, ...recentlyCorrect];
  combined = [...new Set(combined)];

  if (sessionSize === 10) {
    combined = combined.slice(0, 10);
  }

  return combined;
}

export function useSRSQueue() {
  const buildQueue = useCallback(
    async (
      scope: SessionScope,
      sessionSize: 10 | 'all',
    ): Promise<string[]> => {
      if (scope === 'all') {
        return buildReviewAllQueue(sessionSize);
      }
      return buildSingleFocusQueue(scope, sessionSize);
    },
    [],
  );

  return { buildQueue };
}
