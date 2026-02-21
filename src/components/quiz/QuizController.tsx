import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GeoItem, QuizResult, AnswerRating, Focus } from '../../types/geo';
import { useAppStore } from '../../store/appStore';
import { getItem, getItemsByFocus } from '../../lib/itemUtils';
import { saveCard, getCard } from '../../db/cardOps';
import { saveSession } from '../../db/sessionOps';
import { scheduleCard, createEmptyCard } from '../../lib/fsrs';
import { MapContainer } from '../maps/MapContainer';
import { TypeSelectQuiz } from './TypeSelectQuiz';
import { FeedbackOverlay, type FeedbackState } from './FeedbackOverlay';
import { ProgressBar } from '../ui/ProgressBar';
import { useProgress } from '../../hooks/useProgress';

/**
 * QuizController orchestrates the multiple-choice quiz flow.
 */
export function QuizController() {
  const navigate = useNavigate();
  const { session, currentItemIndex, recordResult, advanceQueue, endSession } = useAppStore();
  const { refreshProgress } = useProgress();

  // ── Type/Select state ───────────────────────────────────────────────────
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle');
  const [lastAnswer, setLastAnswer] = useState('');
  const [correctIds, setCorrectIds] = useState<Set<string>>(new Set());
  const [incorrectIds, setIncorrectIds] = useState<Set<string>>(new Set());

  const itemStartTime = useRef(Date.now());
  useEffect(() => {
    itemStartTime.current = Date.now();
  }, [currentItemIndex]);

  const currentItemId = session?.queue[currentItemIndex] ?? null;

  const currentItem = useMemo<GeoItem | null>(
    () => (currentItemId ? (getItem(currentItemId) ?? null) : null),
    [currentItemId],
  );

  const currentFocus: Focus | null = useMemo(
    () => currentItem?.focus ?? null,
    [currentItem],
  );

  const focusItems = useMemo<GeoItem[]>(
    () => (currentFocus ? getItemsByFocus(currentFocus) : []),
    [currentFocus],
  );

  const isDone = !session || currentItemIndex >= session.queue.length;

  // Navigate to results when session exhausts queue
  useEffect(() => {
    if (!isDone || !session) return;

    // Refresh progress for all focuses that were quizzed
    const focusesQuizzed = new Set(
      session.results.map(r => getItem(r.itemId)?.focus).filter(Boolean) as Focus[]
    );
    Promise.all([...focusesQuizzed].map(f => refreshProgress(f))).catch(console.error);

    endSession();
    saveSession({ ...session, completed: true }).catch(console.error);
    navigate('/quiz/results');
  }, [isDone, session, endSession, navigate, refreshProgress]);

  const handleAnswer = useCallback(
    async (correct: boolean, rating: AnswerRating, attempt: string) => {
      if (!currentItem || !session) return;

      const result: QuizResult = {
        itemId: currentItem.id,
        correct,
        responseTimeMs: Date.now() - itemStartTime.current,
        attempt,
        rating,
      };

      if (correct) {
        setCorrectIds((prev) => new Set([...prev, currentItem.id]));
        setIncorrectIds((prev) => { const n = new Set(prev); n.delete(currentItem.id); return n; });
      } else {
        setIncorrectIds((prev) => new Set([...prev, currentItem.id]));
      }

      setLastAnswer(attempt);
      setFeedbackState(correct ? 'correct' : 'incorrect');

      try {
        const existing = await getCard(currentItem.id);
        const card = existing ?? createEmptyCard(currentItem.id, currentItem.focus);
        const { card: updated } = scheduleCard(card, rating);
        await saveCard(updated);
      } catch (err) {
        console.error('SRS update failed:', err);
      }

      recordResult(result);
    },
    [currentItem, session, recordResult],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackState('idle');
    // Clear incorrect highlighting - it should only show briefly during feedback
    setIncorrectIds(new Set());
    advanceQueue();
  }, [advanceQueue]);

  if (!session) return null;
  if (!currentItem || !currentFocus) return null;

  return (
    <div className="flex flex-col h-full gap-4">
      <ProgressBar current={currentItemIndex} total={session.queue.length} />

      <div className="relative">
        <MapContainer
          focus={currentFocus}
          activeItemId={currentItemId}
          correctIds={correctIds}
          incorrectIds={incorrectIds}
          inQuizMode={feedbackState !== 'idle'}
        />
        <FeedbackOverlay
          state={feedbackState}
          correctItem={currentItem}
          userAnswer={lastAnswer}
          onDismiss={handleFeedbackDismiss}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <TypeSelectQuiz
          item={currentItem}
          allItems={focusItems}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}
