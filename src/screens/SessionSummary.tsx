import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { getItem } from '../lib/itemUtils';
import type { Focus } from '../types/geo';

const FOCUS_LABEL: Record<string, string> = {
  us: 'United States',
  world: 'World',
  europe: 'Europe',
};

function formatInterval(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
}

export default function SessionSummary() {
  const navigate = useNavigate();
  const { session, sessionScope } = useAppStore();

  const results = session?.results ?? [];
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Per-focus breakdown for Review All mode
  const focusBreakdown = useMemo(() => {
    if (sessionScope !== 'all') return null;
    const map = new Map<Focus, { correct: number; total: number }>();
    for (const r of results) {
      const item = getItem(r.itemId);
      if (!item) continue;
      const existing = map.get(item.focus) ?? { correct: 0, total: 0 };
      map.set(item.focus, {
        correct: existing.correct + (r.correct ? 1 : 0),
        total: existing.total + 1,
      });
    }
    return map;
  }, [results, sessionScope]);

  // Separate missed items for clear display
  const missedItems = useMemo(
    () => results.filter((r) => !r.correct).map((r) => ({ result: r, item: getItem(r.itemId) })),
    [results],
  );

  const resultRows = useMemo(
    () => results.slice(0, 10).map((r) => ({ result: r, item: getItem(r.itemId) })),
    [results],
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-xl flex flex-col gap-6">

        {/* Score */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-600 mb-2">Session Complete</h2>
          <div
            className={`text-6xl font-bold mb-1 ${
              pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-400'
            }`}
          >
            {total > 0 ? `${pct}%` : '—'}
          </div>
          <p className="text-slate-500">
            {correct} / {total} correct
          </p>
        </div>

        {/* Missed items - show prominently if any */}
        {missedItems.length > 0 && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-5 shadow-sm">
            <h3 className="font-semibold text-red-700 mb-3">
              Missed ({missedItems.length})
            </h3>
            <div className="flex flex-col gap-2">
              {missedItems.map(({ result, item }) => (
                <div key={result.itemId} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-red-800 font-medium">
                    {item ? item.nameEn : result.itemId}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-red-600 text-xs mt-3">
              These will appear again soon for extra practice.
            </p>
          </div>
        )}

        {/* Review All per-focus breakdown */}
        {focusBreakdown && focusBreakdown.size > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-3">By Focus</h3>
            <div className="flex flex-col gap-2">
              {Array.from(focusBreakdown.entries()).map(([focus, stats]) => (
                <div key={focus} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{FOCUS_LABEL[focus] ?? focus}</span>
                  <span className="font-medium text-slate-800">
                    {stats.correct}/{stats.total}
                    <span className="text-slate-400 font-normal ml-1">
                      ({Math.round((stats.correct / stats.total) * 100)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next reviews preview */}
        {resultRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Items Reviewed</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {resultRows.map(({ result, item }) => (
                <div
                  key={result.itemId}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        result.correct ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-slate-700 truncate max-w-[220px]">
                      {item ? item.nameEn : result.itemId}
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs whitespace-nowrap ml-3">
                    {result.correct ? formatInterval(1) : 'retry soon'}
                  </span>
                </div>
              ))}
              {results.length > 10 && (
                <div className="px-5 py-2 text-xs text-slate-400">
                  …and {results.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 border-2 border-slate-200 rounded-xl text-slate-600 font-medium hover:border-slate-300 transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => navigate('/quiz/setup')}
            className="flex-1 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
          >
            Another Session
          </button>
        </div>
      </div>
    </div>
  );
}
