import { useEffect, useState, useCallback } from 'react';
import type { GeoItem } from '../../types/geo';
import { GeoLabel } from '../ui/GeoLabel';

type FeedbackState = 'correct' | 'incorrect' | 'idle';

interface FeedbackOverlayProps {
  state: FeedbackState;
  /** The correct item (shown in both correct and incorrect cases) */
  correctItem: GeoItem | null;
  /** What the user typed/selected (shown on incorrect) */
  userAnswer?: string;
  /** Called after the overlay has finished displaying */
  onDismiss: () => void;
}

const CORRECT_DISPLAY_DURATION_MS = 1500;

/**
 * Overlays a correct/incorrect result flash on top of the quiz.
 * Correct: auto-dismisses after 1.5s.
 * Incorrect: requires user to click "OK" to continue (allows time to study the answer).
 */
export function FeedbackOverlay({
  state,
  correctItem,
  userAnswer,
  onDismiss,
}: FeedbackOverlayProps) {
  const [visible, setVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (state === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);

    // Only auto-dismiss for correct answers
    if (state === 'correct') {
      const timer = setTimeout(handleDismiss, CORRECT_DISPLAY_DURATION_MS);
      return () => clearTimeout(timer);
    }
    // Incorrect answers require user to click OK
  }, [state, handleDismiss]);

  if (!visible || state === 'idle') return null;

  const isCorrect = state === 'correct';

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center z-20 rounded-xl ${
        isCorrect ? 'bg-emerald-500/20' : 'bg-red-500/20'
      }`}
    >
      <div
        className={`px-6 py-4 rounded-2xl shadow-lg text-center max-w-xs ${
          isCorrect
            ? 'bg-emerald-500 text-white'
            : 'bg-red-500 text-white'
        }`}
      >
        <div className="text-2xl font-bold mb-1">
          {isCorrect ? '✓ Correct' : '✗ Incorrect'}
        </div>
        {!isCorrect && userAnswer && (
          <div className="text-sm opacity-90 mb-2">
            You answered: <em>{userAnswer}</em>
          </div>
        )}
        {!isCorrect && correctItem && (
          <div className="text-sm font-semibold bg-white/20 rounded-lg px-3 py-2 mb-3">
            Answer:{' '}
            <GeoLabel item={correctItem} />
          </div>
        )}
        {!isCorrect && (
          <button
            onClick={handleDismiss}
            className="mt-2 px-6 py-2 bg-white text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}

export type { FeedbackState };
