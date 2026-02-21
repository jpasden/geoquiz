import { useEffect, useState, useMemo } from 'react';
import type { Focus } from '../../types/geo';
import { getCardsByFocus } from '../../db/cardOps';
import { getItemsByFocus } from '../../lib/itemUtils';
import type { GeoCard } from '../../types/geo';

type SortKey = 'name' | 'interval' | 'nextReview' | 'reps';
type SortDir = 'asc' | 'desc';

interface Row {
  card: GeoCard;
  nameEn: string;
  focus: Focus;
}

const MASTERY_LABEL: Record<string, { label: string; cls: string }> = {
  new:        { label: 'New',      cls: 'bg-slate-100 text-slate-500' },
  learning:   { label: 'Learning', cls: 'bg-orange-100 text-orange-700' },
  relearning: { label: 'Relearn',  cls: 'bg-red-100 text-red-700' },
  review:     { label: 'Review',   cls: 'bg-teal-100 text-teal-700' },
};

function intervalLabel(days: number): string {
  if (days === 0) return '—';
  if (days === 1) return '1 day';
  if (days < 30)  return `${days} days`;
  const w = Math.round(days / 7);
  return `${w}w`;
}

function nextReviewLabel(ms: number): string {
  if (ms === 0) return 'unseen';
  const diffMs = ms - Date.now();
  const days = Math.round(diffMs / 86_400_000);
  if (days < 0)  return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days}d`;
}

interface ProgressListViewProps {
  focus: Focus;
}

export function ProgressListView({ focus }: ProgressListViewProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('nextReview');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    setLoading(true);
    getCardsByFocus(focus)
      .then((cards) => {
        const items = getItemsByFocus(focus);
        const itemMap = new Map(items.map((i) => [i.id, i]));
        const built: Row[] = cards.map((card) => {
          const item = itemMap.get(card.id);
          return {
            card,
            nameEn: item?.nameEn ?? card.id,
            focus,
          };
        });
        setRows(built);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [focus]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':       cmp = a.nameEn.localeCompare(b.nameEn); break;
        case 'interval':   cmp = a.card.scheduledDays - b.card.scheduledDays; break;
        case 'nextReview': cmp = a.card.nextReview - b.card.nextReview; break;
        case 'reps':       cmp = a.card.reps - b.card.reps; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label}
      {sortKey === col && (
        <span className="ml-1 text-teal-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );

  if (loading) {
    return <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        No cards yet — start a quiz session to begin learning.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="border-b border-slate-200">
          <tr>
            <SortHeader label="Name" col="name" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
            <SortHeader label="Interval" col="interval" />
            <SortHeader label="Next Review" col="nextReview" />
            <SortHeader label="Reviews" col="reps" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map(({ card, nameEn }) => {
            const mastery = MASTERY_LABEL[card.state] ?? MASTERY_LABEL.new;
            return (
              <tr key={card.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {nameEn}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${mastery.cls}`}>
                    {mastery.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{intervalLabel(card.scheduledDays)}</td>
                <td className="px-4 py-3 text-slate-600">{nextReviewLabel(card.nextReview)}</td>
                <td className="px-4 py-3 text-slate-500">{card.reps}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
