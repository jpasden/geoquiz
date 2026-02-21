import { describe, it, expect } from 'vitest';
import {
  PROJECTION_CONFIGS,
  MAX_ZOOM,
  MAP_WIDTH,
  MAP_HEIGHT,
} from './projections';

describe('projections', () => {
  describe('PROJECTION_CONFIGS', () => {
    it('has configs for all three focuses', () => {
      expect(PROJECTION_CONFIGS.us).toBeDefined();
      expect(PROJECTION_CONFIGS.world).toBeDefined();
      expect(PROJECTION_CONFIGS.europe).toBeDefined();
    });

    it('uses AlbersUSA for US focus', () => {
      expect(PROJECTION_CONFIGS.us.projection).toBe('geoAlbersUsa');
    });

    it('uses Natural Earth for World focus', () => {
      expect(PROJECTION_CONFIGS.world.projection).toBe('geoNaturalEarth1');
    });

    it('uses Mercator for Europe focus centered around 15E', () => {
      expect(PROJECTION_CONFIGS.europe.projection).toBe('geoMercator');
      expect(PROJECTION_CONFIGS.europe.projectionConfig.center).toEqual([15, 54]);
    });
  });

  describe('constants', () => {
    it('has reasonable map dimensions', () => {
      expect(MAP_WIDTH).toBe(800);
      expect(MAP_HEIGHT).toBe(500);
    });

    it('has MAX_ZOOM set to 8 for micro-states', () => {
      expect(MAX_ZOOM).toBe(8);
    });
  });
});
