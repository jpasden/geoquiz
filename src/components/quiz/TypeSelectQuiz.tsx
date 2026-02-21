import { useEffect, useState, useMemo } from 'react';
import type { GeoItem, AnswerRating } from '../../types/geo';
import { GeoLabel } from '../ui/GeoLabel';

interface MultipleChoiceQuizProps {
  /** The item being quizzed */
  item: GeoItem;
  /** All items in the focus pool (for distractor selection) */
  allItems: GeoItem[];
  /** Called when the user selects an answer */
  onAnswer: (correct: boolean, rating: AnswerRating, attempt: string) => void;
}

type QuizPhase = 'choosing' | 'revealed';

/**
 * Pick distractors for multiple choice options.
 * Prefers items with similar difficulty (±1) for better gameplay.
 */
function pickDistractors(correct: GeoItem, pool: GeoItem[], count = 3): GeoItem[] {
  // Filter to same focus
  const candidates = pool.filter(
    (i) => i.id !== correct.id && i.focus === correct.focus,
  );

  // Prefer similar difficulty
  const nearDifficulty = candidates.filter(
    (i) => Math.abs(i.difficulty - correct.difficulty) <= 1,
  );

  const source = nearDifficulty.length >= count ? nearDifficulty : candidates;

  // Shuffle and take count
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Multiple choice quiz component.
 * Shows 4 options (1 correct + 3 distractors).
 * - Correct → rating 4 (Easy)
 * - Incorrect → rating 1 (Again), reveal correct answer
 */
export function TypeSelectQuiz({ item, allItems, onAnswer }: MultipleChoiceQuizProps) {
  const [phase, setPhase] = useState<QuizPhase>('choosing');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Build options when item changes
  const options = useMemo(() => {
    const distractors = pickDistractors(item, allItems);
    return shuffle([item, ...distractors]);
  }, [item, allItems]);

  // Reset state when item changes
  useEffect(() => {
    setPhase('choosing');
    setSelectedId(null);
  }, [item.id]);

  const handleSelect = (selected: GeoItem) => {
    if (phase !== 'choosing') return;

    setSelectedId(selected.id);
    const isCorrect = selected.id === item.id;

    if (isCorrect) {
      onAnswer(true, 4, selected.nameEn); // Easy — correct
    } else {
      setPhase('revealed');
      onAnswer(false, 1, selected.nameEn); // Again — incorrect
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt */}
      <div className="text-center">
        <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">
          Name this region
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          const isCorrectAnswer = option.id === item.id;
          const showAsCorrect = phase === 'revealed' && isCorrectAnswer;
          const showAsIncorrect = phase === 'revealed' && isSelected && !isCorrectAnswer;

          let buttonClasses = 'w-full px-4 py-3 text-left border-2 rounded-xl transition-all font-medium ';

          if (showAsCorrect) {
            buttonClasses += 'border-emerald-500 bg-emerald-50 text-emerald-800';
          } else if (showAsIncorrect) {
            buttonClasses += 'border-red-400 bg-red-50 text-red-700';
          } else if (phase === 'choosing') {
            buttonClasses += 'border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50 cursor-pointer';
          } else {
            buttonClasses += 'border-slate-200 text-slate-400';
          }

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              disabled={phase !== 'choosing'}
              className={buttonClasses}
            >
              <GeoLabel item={option} />
              {showAsCorrect && (
                <span className="ml-2 text-emerald-600 text-sm">✓ Correct</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
