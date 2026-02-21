import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useSRSQueue } from '../hooks/useSRSQueue';
import { useMapLayer } from '../hooks/useMapLayer';

export default function QuizSetup() {
  const navigate = useNavigate();
  const { sessionScope, sessionSize, activeFocus, startSession } = useAppStore();
  const { buildQueue } = useSRSQueue();
  const [loading, setLoading] = useState(true);
  const [queueSize, setQueueSize] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Preload map data so items are registered before building the queue
  const focusToLoad = sessionScope === 'all' ? null : (sessionScope as typeof activeFocus);
  const { loading: mapLoading } = useMapLayer(focusToLoad);

  useEffect(() => {
    if (mapLoading) return;
    setLoading(true);
    buildQueue(sessionScope, sessionSize)
      .then((queue) => {
        setQueueSize(queue.length);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [sessionScope, sessionSize, mapLoading, buildQueue]);

  async function handleStart() {
    const queue = await buildQueue(sessionScope, sessionSize);
    startSession(queue, sessionScope, sessionSize);
    navigate('/quiz/session');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Session Preview</h2>
        <p className="text-slate-500 text-sm mb-6">
          {sessionScope === 'all' ? 'Review All' : `Focus: ${sessionScope.toUpperCase()}`}
        </p>

        {loading && (
          <div className="text-slate-500 py-4">Loading queue…</div>
        )}
        {error && (
          <div className="text-red-600 text-sm py-4">{error}</div>
        )}
        {!loading && !error && (
          <div className="mb-6">
            <div className="text-4xl font-bold text-teal-600">{queueSize}</div>
            <div className="text-slate-500 text-sm mt-1">
              items in this session
            </div>
            {queueSize === 0 && sessionScope === 'all' && (
              <p className="text-amber-600 text-sm mt-3">
                No items to review across all focuses. Try selecting a specific focus to study new items.
              </p>
            )}
            {queueSize === 0 && sessionScope !== 'all' && (
              <p className="text-amber-600 text-sm mt-3">
                You've mastered all available items at your current level! Keep practicing to unlock harder items.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 border-2 border-slate-200 rounded-xl text-slate-600 font-medium hover:border-slate-300 transition-colors"
          >
            Back
          </button>
          <button
            disabled={loading || queueSize === 0}
            onClick={handleStart}
            className="flex-1 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
