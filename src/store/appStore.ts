import { create } from 'zustand';
import type {
  Focus,
  SessionScope,
  QuizSession,
  QuizResult,
  AppSettings,
} from '../types/geo';

interface AppState {
  // ── Session config ──────────────────────────────────────────────────────
  activeFocus: Focus | null;
  sessionScope: SessionScope;
  sessionSize: 10 | 'all';
  settings: AppSettings;

  // ── Active session ──────────────────────────────────────────────────────
  session: QuizSession | null;
  currentItemIndex: number;

  // ── UI ──────────────────────────────────────────────────────────────────
  tooltipItemId: string | null;
  highlightedItemId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  setFocus: (focus: Focus) => void;
  setScope: (scope: SessionScope) => void;
  setSessionSize: (size: 10 | 'all') => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  startSession: (queue: string[], scope: SessionScope, size: 10 | 'all') => void;
  recordResult: (result: QuizResult) => void;
  advanceQueue: () => void;
  endSession: () => void;
  setTooltipItem: (id: string | null) => void;
  setHighlightedItem: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // defaults
  activeFocus: null,
  sessionScope: 'us',
  sessionSize: 10,
  settings: { progressView: 'map' },
  session: null,
  currentItemIndex: 0,
  tooltipItemId: null,
  highlightedItemId: null,

  setFocus: (focus) => set({ activeFocus: focus, sessionScope: focus }),
  setScope: (scope) => set({ sessionScope: scope }),
  setSessionSize: (size) => set({ sessionSize: size }),
  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),

  startSession: (queue, scope, size) =>
    set({
      session: {
        id: `session-${Date.now()}`,
        startedAt: Date.now(),
        scope,
        sessionSize: size,
        queue,
        results: [],
        completed: false,
      },
      currentItemIndex: 0,
    }),

  recordResult: (result) =>
    set((state) => {
      if (!state.session) return {};
      return {
        session: {
          ...state.session,
          results: [...state.session.results, result],
        },
      };
    }),

  advanceQueue: () =>
    set((state) => ({ currentItemIndex: state.currentItemIndex + 1 })),

  endSession: () =>
    set((state) => {
      if (!state.session) return {};
      return {
        session: { ...state.session, completed: true },
      };
    }),

  setTooltipItem: (id) => set({ tooltipItemId: id }),
  setHighlightedItem: (id) => set({ highlightedItemId: id }),
}));
