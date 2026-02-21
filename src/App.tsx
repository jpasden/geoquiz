import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import HomeScreen from './screens/HomeScreen';
import QuizSetup from './screens/QuizSetup';
import QuizSession from './screens/QuizSession';
import SessionSummary from './screens/SessionSummary';
import ProgressDashboard from './screens/ProgressDashboard';
import Settings from './screens/Settings';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/quiz/setup" element={<QuizSetup />} />
          <Route path="/quiz/session" element={<QuizSession />} />
          <Route path="/quiz/results" element={<SessionSummary />} />
          <Route path="/progress" element={<ProgressDashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
