import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeItemId,
  formatLabel,
  registerItems,
  getItem,
  getItemsByFocus,
  getAllItems,
  clearRegistry,
} from './itemUtils';
import type { GeoItem } from '../types/geo';

describe('itemUtils', () => {
  describe('makeItemId', () => {
    it('generates correct id format for regions', () => {
      expect(makeItemId('us', 'CA')).toBe('us-region-ca');
      expect(makeItemId('world', 'USA')).toBe('world-region-usa');
    });

    it('handles spaces in names', () => {
      expect(makeItemId('us', 'New York')).toBe('us-region-new-york');
    });

    it('converts slug to lowercase', () => {
      expect(makeItemId('us', 'CALIFORNIA')).toBe('us-region-california');
    });
  });

  describe('formatLabel', () => {
    it('returns name with Chinese translation for US states', () => {
      expect(formatLabel({ nameEn: 'California', nameZh: '加利福尼亚', focus: 'us' }))
        .toBe('California (加利福尼亚)');
    });

    it('returns name with Chinese and flag for world countries', () => {
      expect(formatLabel({ nameEn: 'France', nameZh: '法国', flagEmoji: '🇫🇷', focus: 'world' }))
        .toBe('France (法国) 🇫🇷');
    });

    it('returns name with Chinese and flag for Europe countries', () => {
      expect(formatLabel({ nameEn: 'Germany', nameZh: '德国', flagEmoji: '🇩🇪', focus: 'europe' }))
        .toBe('Germany (德国) 🇩🇪');
    });

    it('returns English only for items without Chinese name', () => {
      expect(formatLabel({ nameEn: 'Unknown Place', focus: 'us' })).toBe('Unknown Place');
    });
  });

  describe('item registry', () => {
    beforeEach(() => {
      clearRegistry();
    });

    const testItems: GeoItem[] = [
      {
        id: 'us-region-ca',
        focus: 'us',
        nameEn: 'California',
        aliases: ['california', 'ca'],
        difficulty: 1,
      },
      {
        id: 'us-region-ny',
        focus: 'us',
        nameEn: 'New York',
        aliases: ['new york', 'ny'],
        difficulty: 2,
      },
      {
        id: 'europe-region-fra',
        focus: 'europe',
        nameEn: 'France',
        aliases: ['france', 'fra'],
        difficulty: 1,
      },
    ];

    it('registers and retrieves items by id', () => {
      registerItems(testItems);

      const ca = getItem('us-region-ca');
      expect(ca).toBeDefined();
      expect(ca?.nameEn).toBe('California');

      const fr = getItem('europe-region-fra');
      expect(fr).toBeDefined();
      expect(fr?.nameEn).toBe('France');
    });

    it('returns undefined for non-existent items', () => {
      registerItems(testItems);
      expect(getItem('nonexistent-id')).toBeUndefined();
    });

    it('filters items by focus', () => {
      registerItems(testItems);

      const usItems = getItemsByFocus('us');
      expect(usItems).toHaveLength(2);
      expect(usItems.every((i) => i.focus === 'us')).toBe(true);

      const europeItems = getItemsByFocus('europe');
      expect(europeItems).toHaveLength(1);
      expect(europeItems[0].nameEn).toBe('France');
    });

    it('returns empty array for focus with no items', () => {
      registerItems(testItems);
      const worldItems = getItemsByFocus('world');
      expect(worldItems).toHaveLength(0);
    });

    it('returns all registered items', () => {
      registerItems(testItems);
      const all = getAllItems();
      expect(all).toHaveLength(3);
    });

    it('clears the registry', () => {
      registerItems(testItems);
      expect(getAllItems()).toHaveLength(3);

      clearRegistry();
      expect(getAllItems()).toHaveLength(0);
    });
  });
});
