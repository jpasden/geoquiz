import { useState, useEffect } from 'react';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Focus } from '../types/geo';
import type { GeoItem } from '../types/geo';
import {
  parseUSStateFeatures,
  parseWorldCountryFeatures,
  parseEuropeCountryFeatures,
  registerItems,
} from '../lib/itemUtils';

/**
 * Check if data is TopoJSON format
 */
function isTopoJSON(data: unknown): data is Topology {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as { type: string }).type === 'Topology' &&
    'objects' in data
  );
}

/**
 * Convert TopoJSON to GeoJSON FeatureCollection
 * Returns the first object found in the topology
 */
function topoToGeo(topo: Topology): GeoJSON.FeatureCollection {
  const objectKeys = Object.keys(topo.objects);
  if (objectKeys.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }
  const firstKey = objectKeys[0];
  const obj = topo.objects[firstKey] as GeometryCollection;
  return topojson.feature(topo, obj) as GeoJSON.FeatureCollection;
}

export interface MapLayer {
  regions: GeoJSON.FeatureCollection;
  items: GeoItem[];
  loading: boolean;
  error: string | null;
}

const cache = new Map<Focus, MapLayer>();

/**
 * Parse region data from either GeoJSON or TopoJSON format
 */
function parseRegionData(data: unknown): GeoJSON.FeatureCollection {
  if (isTopoJSON(data)) {
    return topoToGeo(data);
  }
  return data as GeoJSON.FeatureCollection;
}

async function loadFocusData(focus: Focus): Promise<MapLayer> {
  if (cache.has(focus)) return cache.get(focus)!;

  let regionData: GeoJSON.FeatureCollection;
  let regionItems: GeoItem[];

  switch (focus) {
    case 'us': {
      const r = await import('../data/us-states.json');
      regionData = parseRegionData(r.default);
      regionItems = parseUSStateFeatures(regionData);
      break;
    }
    case 'world': {
      const r = await import('../data/world-countries.json');
      regionData = parseRegionData(r.default);
      regionItems = parseWorldCountryFeatures(regionData);
      break;
    }
    case 'europe': {
      const r = await import('../data/europe-countries.json');
      regionData = parseRegionData(r.default);
      regionItems = parseEuropeCountryFeatures(regionData);
      break;
    }
  }

  registerItems(regionItems);

  const layer: MapLayer = {
    regions: regionData,
    items: regionItems,
    loading: false,
    error: null,
  };
  cache.set(focus, layer);
  return layer;
}

export function useMapLayer(focus: Focus | null): MapLayer {
  // Start with loading: true if a focus is provided, to prevent race conditions
  // where consumers try to use items before they're registered
  const [layer, setLayer] = useState<MapLayer>(() => ({
    regions: { type: 'FeatureCollection', features: [] },
    items: [],
    loading: focus !== null,
    error: null,
  }));

  useEffect(() => {
    if (!focus) return;
    setLayer((prev) => ({ ...prev, loading: true, error: null }));
    loadFocusData(focus)
      .then(setLayer)
      .catch((err) => setLayer((prev) => ({ ...prev, loading: false, error: String(err) })));
  }, [focus]);

  return layer;
}
