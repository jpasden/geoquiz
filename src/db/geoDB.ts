import { openDB, type IDBPDatabase } from 'idb';
import type { GeoCard, QuizSession, AppSettings, UserProgress } from '../types/geo';

const DB_NAME = 'geoquiz-db';
const DB_VERSION = 2;

export interface GeoquizDB {
  geo_cards: {
    key: string;
    value: GeoCard;
    indexes: {
      by_focus: string;
      by_nextReview: number;
      by_focus_due: [string, number];
    };
  };
  sessions: {
    key: string;
    value: QuizSession;
    indexes: {
      by_startedAt: number;
      by_scope: string;
    };
  };
  settings: {
    key: string;
    value: { key: string } & AppSettings;
  };
  user_progress: {
    key: string;
    value: UserProgress;
  };
}

let dbPromise: Promise<IDBPDatabase<GeoquizDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<GeoquizDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GeoquizDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Version 1: Initial schema
        if (oldVersion < 1) {
          // geo_cards store
          const cardStore = db.createObjectStore('geo_cards', { keyPath: 'id' });
          cardStore.createIndex('by_focus', 'focus');
          cardStore.createIndex('by_nextReview', 'nextReview');
          cardStore.createIndex('by_focus_due', ['focus', 'nextReview']);

          // sessions store
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by_startedAt', 'startedAt');
          sessionStore.createIndex('by_scope', 'scope');

          // settings store (single record per setting key)
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Version 2: Add user_progress store
        if (oldVersion < 2) {
          db.createObjectStore('user_progress', { keyPath: 'focus' });
        }
      },
    });
  }
  return dbPromise;
}
