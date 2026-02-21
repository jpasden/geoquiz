import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { GeoItem } from '../types/geo';

export interface FuzzyResult {
  item: GeoItem;
  /** Fuse score: 0 = perfect match, 1 = no match. Inverted to 0–1 "similarity". */
  score: number;
}

export type MatchType = 'exact' | 'fuzzy' | 'none';

export interface MatchResult {
  matched: boolean;
  matchType: MatchType;
}

/**
 * Returns a match function against a pool of GeoItems.
 * threshold 0.35 per spec §6.2.
 */
export function useFuzzyMatch(items: GeoItem[]) {
  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: ['nameEn', 'aliases'],
        threshold: 0.35,
        includeScore: true,
        isCaseSensitive: false,
        minMatchCharLength: 1,
      }),
    [items],
  );

  /**
   * Check whether `input` matches `target`.
   * Returns { matched, matchType }.
   */
  function checkAnswer(input: string, target: GeoItem): MatchResult {
    const trimmed = input.trim();
    if (!trimmed) return { matched: false, matchType: 'none' };

    // Exact match (case-insensitive)
    const lower = trimmed.toLowerCase();
    if (lower === target.nameEn.toLowerCase()) {
      return { matched: true, matchType: 'exact' };
    }

    // Alias exact match
    if (target.aliases.some((a) => a.toLowerCase() === lower)) {
      return { matched: true, matchType: 'exact' };
    }

    // Fuzzy match
    const results = fuse.search(trimmed);
    const topHit = results.find((r) => r.item.id === target.id);
    if (topHit && topHit.score !== undefined && topHit.score <= 0.35) {
      return { matched: true, matchType: 'fuzzy' };
    }

    return { matched: false, matchType: 'none' };
  }

  /**
   * Search for items matching `query` — used for keyboard snap in drag-drop mode.
   * Returns results sorted by score, filtered to threshold 0.35.
   */
  function search(query: string): FuzzyResult[] {
    if (!query.trim()) return [];
    return fuse
      .search(query.trim())
      .filter((r) => r.score !== undefined && r.score <= 0.35)
      .map((r) => ({ item: r.item, score: 1 - (r.score ?? 0) }));
  }

  return { checkAnswer, search };
}
