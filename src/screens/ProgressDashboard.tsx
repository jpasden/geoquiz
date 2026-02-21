import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { ProgressMapView } from '../components/progress/ProgressMapView';
import { ProgressListView } from '../components/progress/ProgressListView';
import type { Focus } from '../types/geo';

const FOCUSES: { id: Focus; label: string; emoji: string }[] = [
  { id: 'us',     label: 'United States', emoji: '🇺🇸' },
  { id: 'world',  label: 'World',         emoji: '🌍' },
  { id: 'europe', label: 'Europe',        emoji: '🇪🇺' },
];

export default function ProgressDashboard() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useAppStore();
  const [activeFocus, setActiveFocus] = useState<Focus>('us');

  const view = settings.progressView;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Progress</h1>
        <div className="flex items-center gap-3">
          {/* Map / List toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => updateSettings({ progressView: 'map' })}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                view === 'map'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Map
            </button>
            <button
              onClick={() => updateSettings({ progressView: 'list' })}
              className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-slate-200 ${
                view === 'list'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Focus tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 gap-1 overflow-x-auto">
        {FOCUSES.map(({ id, label, emoji }) => (
          <button
            key={id}
            onClick={() => setActiveFocus(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeFocus === id
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {view === 'map' ? (
          <ProgressMapView focus={activeFocus} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <ProgressListView focus={activeFocus} />
          </div>
        )}
      </div>
    </div>
  );
}
