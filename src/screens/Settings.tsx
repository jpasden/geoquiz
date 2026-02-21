import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAllCards, deleteCardsByFocus, getCardsByFocus } from '../db/cardOps';
import { deleteAllSessions } from '../db/sessionOps';
import { deleteAllProgress } from '../db/progressOps';
import type { Focus } from '../types/geo';

const FOCUSES: { id: Focus; label: string }[] = [
  { id: 'us',     label: 'United States' },
  { id: 'world',  label: 'World' },
  { id: 'europe', label: 'Europe' },
];

interface FocusStats {
  total: number;
  reviewed: number;
  mastered: number;
}

export default function Settings() {
  const navigate = useNavigate();
  const [focusStats, setFocusStats] = useState<Record<Focus, FocusStats>>({
    us:     { total: 0, reviewed: 0, mastered: 0 },
    world:  { total: 0, reviewed: 0, mastered: 0 },
    europe: { total: 0, reviewed: 0, mastered: 0 },
  });
  const [resetConfirm, setResetConfirm] = useState<Focus | 'all' | null>(null);
  const [justReset, setJustReset] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const entries = await Promise.all(
      FOCUSES.map(async ({ id }) => {
        const cards = await getCardsByFocus(id);
        return [
          id,
          {
            total: cards.length,
            reviewed: cards.filter((c) => c.reps > 0).length,
            mastered: cards.filter((c) => c.scheduledDays >= 21).length,
          },
        ] as [Focus, FocusStats];
      }),
    );
    setFocusStats(Object.fromEntries(entries) as Record<Focus, FocusStats>);
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  async function handleResetFocus(focus: Focus) {
    await deleteCardsByFocus(focus);
    setResetConfirm(null);
    setJustReset(focus);
    setTimeout(() => setJustReset(null), 2000);
    await loadStats();
  }

  async function handleResetAll() {
    await Promise.all([deleteAllCards(), deleteAllSessions(), deleteAllProgress()]);
    setResetConfirm(null);
    setJustReset('all');
    setTimeout(() => setJustReset(null), 2000);
    await loadStats();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-slate-700 text-lg transition-colors border-0 bg-transparent p-0"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        </div>

        {/* Progress summary */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Progress Summary</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {FOCUSES.map(({ id, label }) => {
              const s = focusStats[id];
              return (
                <div key={id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-slate-700 font-medium">{label}</span>
                  <span className="text-slate-400 text-xs">
                    {s.reviewed}/{s.total} reviewed · {s.mastered} mastered
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reset by focus */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Reset Focus Progress</h3>
            <p className="text-xs text-slate-400 mt-0.5">Clears all SRS cards for one focus.</p>
          </div>
          <div className="p-5 flex flex-wrap gap-2">
            {FOCUSES.map(({ id, label }) => (
              <div key={id}>
                {resetConfirm === id ? (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-slate-600">Reset {label}?</span>
                    <button
                      onClick={() => handleResetFocus(id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setResetConfirm(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs hover:border-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setResetConfirm(id)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      justReset === id
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {justReset === id ? '✓ Reset' : `Reset ${label}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Reset all */}
        <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-red-50">
            <h3 className="font-semibold text-red-700">Reset All Progress</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Permanently clears all cards and session history. Cannot be undone.
            </p>
          </div>
          <div className="p-5">
            {resetConfirm === 'all' ? (
              <div className="flex gap-3 items-center">
                <span className="text-sm text-slate-700 font-medium">Are you sure?</span>
                <button
                  onClick={handleResetAll}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                >
                  Yes, reset everything
                </button>
                <button
                  onClick={() => setResetConfirm(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:border-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setResetConfirm('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  justReset === 'all'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {justReset === 'all' ? '✓ Reset complete' : 'Reset Everything'}
              </button>
            )}
          </div>
        </section>

        {/* App version / about */}
        <p className="text-center text-xs text-slate-400">GeoQuiz v0.1.0 · Offline-first · No account required</p>
      </div>
    </div>
  );
}
