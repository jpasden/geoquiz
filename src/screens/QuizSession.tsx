import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { QuizController } from '../components/quiz/QuizController';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

export default function QuizSession() {
  const navigate = useNavigate();
  const { session } = useAppStore();

  useEffect(() => {
    if (!session) navigate('/');
  }, [session, navigate]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <span className="font-semibold text-slate-700">
          {session.scope === 'all' ? 'Review All' : session.scope.toUpperCase()}
        </span>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-slate-400 hover:text-slate-700 transition-colors border-0 bg-transparent p-0"
        >
          ✕ Exit
        </button>
      </div>

      {/* Main quiz area */}
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 gap-4">
        <ErrorBoundary>
          <QuizController />
        </ErrorBoundary>
      </div>
    </div>
  );
}
