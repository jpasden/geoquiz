import type { GeoItem, Focus, Difficulty } from '../types/geo';
import { getChineseName, getFlagEmoji } from '../data/i18n-zh';

// ─── Difficulty helpers ───────────────────────────────────────────────────

/**
 * Extract difficulty from feature properties, defaulting to 1 (easiest).
 * Until difficulty is assigned to data, all items are accessible at level 1.
 */
function getDifficulty(props: Record<string, unknown>): Difficulty {
  const d = Number(props.DIFFICULTY ?? props.difficulty ?? 1);
  if (d >= 1 && d <= 5) return d as Difficulty;
  return 1;
}

// ─── ID generation ─────────────────────────────────────────────────────────

/**
 * Generate a canonical GeoItem id.
 * Examples: "us-region-CA", "world-region-FRA", "europe-region-france"
 */
export function makeItemId(focus: Focus, slug: string): string {
  return `${focus}-region-${slug.toLowerCase().replace(/\s+/g, '-')}`;
}

// ─── Label formatting (spec §8) ────────────────────────────────────────────

/**
 * Format a display label for a GeoItem.
 * Shows: "Name (中文名) 🇫🇷" for countries
 * Shows: "Name (中文名)" for non-countries (states)
 */
export function formatLabel(
  item: Pick<GeoItem, 'nameEn' | 'nameZh' | 'flagEmoji' | 'focus'>,
): string {
  let label = item.nameEn;

  if (item.nameZh) {
    label += ` (${item.nameZh})`;
  }

  if (item.flagEmoji && (item.focus === 'world' || item.focus === 'europe')) {
    label += ` ${item.flagEmoji}`;
  }

  return label;
}

// ─── Data loading helpers ──────────────────────────────────────────────────

/**
 * Parse a US states GeoJSON FeatureCollection into GeoItems.
 */
export function parseUSStateFeatures(
  geojson: GeoJSON.FeatureCollection,
): GeoItem[] {
  return geojson.features.map((f) => {
    const p = f.properties as Record<string, unknown>;
    const nameEn = String(p.NAME);
    return {
      id: makeItemId('us', String(p.STUSPS)),
      focus: 'us' as Focus,
      nameEn,
      nameZh: getChineseName(nameEn, 'us', 'region'),
      aliases: [nameEn.toLowerCase(), String(p.STUSPS).toLowerCase()],
      difficulty: getDifficulty(p),
    };
  });
}

/**
 * ISO_A3 codes to exclude from the world quiz.
 * These are territories, dependencies, or disputed regions that are not
 * independent sovereign states and would be confusing to quiz on.
 */
const WORLD_EXCLUDED_ISO3 = new Set([
  'TWN', // Taiwan — treated as part of China for quiz purposes
  'ATA', // Antarctica — no sovereign state
  'ATF', // French Southern and Antarctic Lands — French territory
  'FLK', // Falkland Islands — British overseas territory
  'GRL', // Greenland — autonomous territory of Denmark
  'NCL', // New Caledonia — French overseas collectivity
  'PRI', // Puerto Rico — US territory
]);

/**
 * Parse a world countries GeoJSON FeatureCollection into GeoItems.
 * Excludes territories and non-sovereign regions.
 */
export function parseWorldCountryFeatures(
  geojson: GeoJSON.FeatureCollection,
): GeoItem[] {
  return geojson.features
    .filter((f) => {
      const iso3 = String((f.properties as Record<string, unknown>).ISO_A3 ?? '');
      return !WORLD_EXCLUDED_ISO3.has(iso3);
    })
    .map((f) => {
      const p = f.properties as Record<string, unknown>;
      const nameEn = String(p.NAME);
      return {
        id: makeItemId('world', String(p.ISO_A3)),
        focus: 'world' as Focus,
        nameEn,
        nameZh: getChineseName(nameEn, 'world', 'region'),
        flagEmoji: getFlagEmoji(nameEn),
        aliases: [nameEn.toLowerCase(), String(p.ISO_A2 ?? '').toLowerCase(), String(p.ISO_A3 ?? '').toLowerCase()].filter(Boolean),
        difficulty: getDifficulty(p),
      };
    });
}

/**
 * Parse Europe countries GeoJSON into GeoItems.
 */
export function parseEuropeCountryFeatures(
  geojson: GeoJSON.FeatureCollection,
): GeoItem[] {
  return geojson.features.map((f) => {
    const p = f.properties as Record<string, unknown>;
    // Some countries have invalid ISO_A3 ("-99"), fall back to NAME
    const isoCode = String(p.ISO_A3 ?? '');
    const validIso = isoCode && !isoCode.startsWith('-') ? isoCode : '';
    const slug = validIso || String(p.NAME);
    const nameEn = String(p.NAME);
    return {
      id: makeItemId('europe', slug),
      focus: 'europe' as Focus,
      nameEn,
      nameZh: getChineseName(nameEn, 'europe', 'region'),
      flagEmoji: getFlagEmoji(nameEn),
      aliases: [nameEn.toLowerCase(), validIso.toLowerCase()].filter(Boolean),
      difficulty: getDifficulty(p),
    };
  });
}

// ─── Item registry (in-memory cache) ──────────────────────────────────────

const itemRegistry = new Map<string, GeoItem>();

export function registerItems(items: GeoItem[]): void {
  for (const item of items) {
    itemRegistry.set(item.id, item);
  }
}

export function getItem(id: string): GeoItem | undefined {
  return itemRegistry.get(id);
}

export function getItemsByFocus(focus: Focus): GeoItem[] {
  return Array.from(itemRegistry.values()).filter((i) => i.focus === focus);
}

export function getAllItems(): GeoItem[] {
  return Array.from(itemRegistry.values());
}

export function clearRegistry(): void {
  itemRegistry.clear();
}
