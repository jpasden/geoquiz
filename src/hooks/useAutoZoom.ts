import { useState, useEffect, useCallback } from 'react';
import type { ExtendedFeature } from 'd3-geo';
import type { GeoItem, Focus } from '../types/geo';
import {
  computeFeatureZoom,
  computeUnionZoom,
  getDefaultCenter,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '../lib/projections';

export interface ZoomState {
  center: [number, number];
  zoom: number;
}

/**
 * Compute and animate zoom/center for the active quiz item (region).
 *
 * Returns null while computing (to prevent flash of wrong zoom).
 */
export function useAutoZoom(
  activeItem: GeoItem | null,
  geoFeatures: GeoJSON.FeatureCollection | null,
  focus: Focus | null,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): ZoomState | null {
  const [zoomState, setZoomState] = useState<ZoomState | null>(null);

  useEffect(() => {
    // No item = no zoom to compute
    if (!activeItem || !focus) {
      setZoomState(null);
      return;
    }

    // Need geoFeatures to compute region zoom
    if (!geoFeatures) {
      // Still loading - keep null to show loading state
      return;
    }
    const feature = findFeatureForItem(activeItem, geoFeatures);
    if (!feature) {
      // Feature not found - use the focus's default center
      console.warn('[useAutoZoom] Feature not found for item:', activeItem.id, 'slug:', activeItem.id.split('-').slice(2).join('-'));
      setZoomState({ center: getDefaultCenter(focus), zoom: 1 });
      return;
    }
    setZoomState(computeFeatureZoom(feature as ExtendedFeature, focus, width, height));
  }, [activeItem, geoFeatures, focus, width, height]);

  return zoomState;
}

/**
 * Compute a fixed union zoom for all items in a session.
 * Returns a stable ZoomState that does not change during the session.
 */
export function useUnionZoom(
  items: GeoItem[],
  geoFeatures: GeoJSON.FeatureCollection | null,
  focus: Focus | null,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): ZoomState {
  const defaultCenter = focus ? getDefaultCenter(focus) : [0, 0] as [number, number];
  const [zoomState, setZoomState] = useState<ZoomState>({ center: defaultCenter, zoom: 1 });

  useEffect(() => {
    if (!focus || items.length === 0) {
      setZoomState({ center: getDefaultCenter(focus ?? 'world'), zoom: 1 });
      return;
    }

    const features: ExtendedFeature[] = [];

    if (geoFeatures) {
      for (const item of items) {
        const f = findFeatureForItem(item, geoFeatures);
        if (f) features.push(f as ExtendedFeature);
      }
    }

    if (features.length === 0) {
      setZoomState({ center: getDefaultCenter(focus), zoom: 1 });
      return;
    }

    setZoomState(computeUnionZoom(features, focus, width, height));
  }, [items, geoFeatures, focus, width, height]);

  return zoomState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function findFeatureForItem(
  item: GeoItem,
  collection: GeoJSON.FeatureCollection,
): GeoJSON.Feature | undefined {
  // Match by properties: try NAME, STUSPS, ISO_A3, GID_1
  const slug = item.id.split('-').slice(2).join('-');
  return collection.features.find((f) => {
    const p = f.properties as Record<string, string> | null;
    if (!p) return false;
    return (
      p.STUSPS?.toLowerCase() === slug ||
      p.ISO_A3?.toLowerCase() === slug ||
      p.GID_1?.toLowerCase() === slug ||
      p.NAME?.toLowerCase() === item.nameEn.toLowerCase()
    );
  });
}

/**
 * Returns a stable callback that resets zoom to default.
 */
export function useResetZoom(): () => void {
  return useCallback(() => ({ center: [0, 0] as [number, number], zoom: 1 }), []);
}
