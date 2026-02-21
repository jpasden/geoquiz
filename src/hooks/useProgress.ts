import { useCallback } from 'react';
import type { Focus } from '../types/geo';
import { getCardsByFocus } from '../db/cardOps';
import { updateProgressForFocus } from '../db/progressOps';
import { countMastered, calculateUnlockedDifficulty } from '../lib/progression';

/**
 * Hook for managing user progression
 */
export function useProgress() {
  /**
   * Recalculate and update progress for a focus after quiz completion
   */
  const refreshProgress = useCallback(async (focus: Focus) => {
    const cards = await getCardsByFocus(focus);
    const masteredCount = countMastered(cards);
    const unlockedDifficulty = calculateUnlockedDifficulty(masteredCount);

    await updateProgressForFocus(focus, masteredCount, unlockedDifficulty);

    return { masteredCount, unlockedDifficulty };
  }, []);

  return { refreshProgress };
}
