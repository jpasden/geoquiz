import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { getDueCardsByFocus } from '../db/cardOps';
import { getProgress } from '../db/progressOps';
import type { Focus, Difficulty } from '../types/geo';

const FOCUSES: { id: Focus; label: string; emoji: string }[] = [
  { id: 'us', label: 'United States', emoji: '🇺🇸' },
  { id: 'world', label: 'World', emoji: '🌍' },
  { id: 'europe', label: 'Europe', emoji: '🇪🇺' },
];

export default function HomeScreen() {
  const navigate = useNavigate();
  const { activeFocus, sessionSize, setFocus, setSessionSize } = useAppStore();
  const [dueCounts, setDueCounts] = useState<Partial<Record<Focus, number>>>({});
  const [unlockLevels, setUnlockLevels] = useState<Partial<Record<Focus, Difficulty>>>({});

  // Load due-today counts and unlock levels for each focus
  useEffect(() => {
    void (async () => {
      const entries = await Promise.all(
        FOCUSES.map(async ({ id }) => {
          const cards = await getDueCardsByFocus(id);
          const progress = await getProgress(id);
          return { id, dueCount: cards.length, unlockLevel: progress.unlockedDifficulty };
        }),
      );
      setDueCounts(Object.fromEntries(entries.map(e => [e.id, e.dueCount])));
      setUnlockLevels(Object.fromEntries(entries.map(e => [e.id, e.unlockLevel])));
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <h1 className="text-4xl font-bold text-slate-800 mb-2">GeoQuiz</h1>
      <p className="text-slate-500 mb-10">Learn world geography with spaced repetition</p>

      {/* Focus picker */}
      <section className="w-full max-w-lg mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Focus
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {FOCUSES.map((f) => {
            const due = dueCounts[f.id] ?? 0;
            const level = unlockLevels[f.id] ?? 1;
            return (
              <button
                key={f.id}
                onClick={() => setFocus(f.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  activeFocus === f.id
                    ? 'border-teal-500 bg-teal-50 text-teal-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">{f.emoji}</span>
                <div className="flex-1">
                  <span className="font-medium block">{f.label}</span>
                  <span className="text-xs text-slate-400">Level {level}/5</span>
                </div>
                {due > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {due} due
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Session size picker */}
      <section className="w-full max-w-lg mb-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Session Size
        </h2>
        <div className="flex gap-3">
          {([10, 'all'] as const).map((size) => (
            <button
              key={String(size)}
              onClick={() => setSessionSize(size)}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                sessionSize === size
                  ? 'border-teal-500 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="font-medium">{size === 10 ? '10 items' : 'Full set'}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Start buttons */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        <button
          disabled={!activeFocus}
          onClick={() => navigate('/quiz/setup')}
          className="w-full py-4 px-6 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {activeFocus ? `Start ${FOCUSES.find((f) => f.id === activeFocus)?.label} Quiz` : 'Select a Focus'}
        </button>
        <button
          onClick={() => {
            useAppStore.getState().setScope('all');
            navigate('/quiz/setup');
          }}
          className="w-full py-3 px-6 border-2 border-slate-300 text-slate-700 font-medium rounded-xl hover:border-slate-400 transition-colors"
        >
          Review All (due items from all focuses)
        </button>
      </div>

      {/* Nav links */}
      <div className="mt-10 flex gap-6 text-sm text-slate-500">
        <button onClick={() => navigate('/progress')} className="hover:text-slate-800 border-0 bg-transparent p-0">
          Progress
        </button>
        <button onClick={() => navigate('/settings')} className="hover:text-slate-800 border-0 bg-transparent p-0">
          Settings
        </button>
      </div>
    </div>
  );
}
