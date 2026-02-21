import { getDB } from './geoDB';
import type { AppSettings } from '../types/geo';

const SETTINGS_KEY = 'app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  progressView: 'map',
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const record = await db.get('settings', SETTINGS_KEY);
  if (!record) return { ...DEFAULT_SETTINGS };
  const { key: _key, ...settings } = record;
  return settings as AppSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key: SETTINGS_KEY, ...settings });
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...patch };
  await saveSettings(updated);
  return updated;
}
