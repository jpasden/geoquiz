import {
  geoAlbersUsa,
  geoNaturalEarth1,
  geoMercator,
  geoPath,
  geoIdentity,
  geoCentroid,
  type GeoPermissibleObjects,
  type ExtendedFeature,
} from 'd3-geo';
import type { Focus } from '../types/geo';

// ─── Projection configs for react-simple-maps ─────────────────────────────

export interface RSMProjectionConfig {
  /** react-simple-maps projection string */
  projection: string;
  projectionConfig: {
    center?: [number, number];
    rotate?: [number, number, number];
    scale?: number;
  };
}

export const PROJECTION_CONFIGS: Record<Focus, RSMProjectionConfig> = {
  us: {
    projection: 'geoAlbersUsa',
    projectionConfig: { scale: 1000 },
  },
  world: {
    projection: 'geoNaturalEarth1',
    projectionConfig: { scale: 147 },
  },
  europe: {
    projection: 'geoMercator',
    projectionConfig: { center: [15, 54], scale: 600 },
  },
};

/**
 * Get the default center coordinates for a focus.
 * This is used when auto-zoom can't find a feature.
 */
export function getDefaultCenter(focus: Focus): [number, number] {
  const cfg = PROJECTION_CONFIGS[focus];
  return (cfg.projectionConfig.center as [number, number]) ?? [0, 0];
}

// ─── Viewport constants ────────────────────────────────────────────────────

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 500;

/** Micro-state maximum zoom ceiling (prevents over-zoom on tiny features) */
export const MAX_ZOOM = 8;

// ─── Bounding box helpers ──────────────────────────────────────────────────

/**
 * European bounding box for filtering out overseas territories.
 * Longitude: -25 (west of Iceland/Portugal) to 70 (eastern Russia/Turkey)
 * Latitude: 34 (south of Cyprus/Crete) to 72 (northern Norway)
 */
const EUROPE_BOUNDS = {
  minLon: -25,
  maxLon: 70,
  minLat: 34,
  maxLat: 72,
};


/**
 * Filter a MultiPolygon to only include polygons with centroids in European bounds.
 * Returns a new feature with filtered geometry, or the original if not a MultiPolygon.
 */
function filterToEuropeanPolygons(feature: ExtendedFeature): ExtendedFeature {
  const geom = feature.geometry;
  if (!geom || geom.type !== 'MultiPolygon') return feature;

  const europeanPolygons: number[][][][] = [];
  for (const polygon of (geom as GeoJSON.MultiPolygon).coordinates) {
    const outerRing = polygon[0];
    if (outerRing && outerRing.length > 0) {
      const lons = outerRing.map(p => p[0]);
      const lats = outerRing.map(p => p[1]);
      const minLon = Math.min(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      // Keep polygon if its western edge starts within European longitude bounds
      // and it has some overlap with European latitudes.
      // This correctly handles Russia: minLon=27 (in Europe) despite extending to lon=180.
      if (minLon <= EUROPE_BOUNDS.maxLon && maxLat >= EUROPE_BOUNDS.minLat && minLat <= EUROPE_BOUNDS.maxLat) {
        europeanPolygons.push(polygon);
      }
    }
  }

  // If no European polygons found, return original (shouldn't happen)
  if (europeanPolygons.length === 0) return feature;

  // Clip coordinates to European longitude/latitude bounds to prevent
  // trans-continental countries (like Russia) from producing huge bounding boxes.
  const clipped = europeanPolygons.map(polygon =>
    polygon.map(ring =>
      ring.map(([lon, lat]) => [
        Math.min(lon, EUROPE_BOUNDS.maxLon),
        Math.max(EUROPE_BOUNDS.minLat, Math.min(lat, EUROPE_BOUNDS.maxLat)),
      ])
    )
  );

  return {
    ...feature,
    geometry: {
      type: clipped.length === 1 ? 'Polygon' : 'MultiPolygon',
      coordinates: clipped.length === 1 ? clipped[0] : clipped,
    } as GeoJSON.Geometry,
  };
}

/**
 * Filter a MultiPolygon to exclude polygons that cross or are near the dateline.
 * This handles countries like Russia that span from Europe to far-eastern Asia.
 * For zoom calculation, we want to focus on the main continental mass.
 */
function filterOutDatelinePolygons(feature: ExtendedFeature): ExtendedFeature {
  const geom = feature.geometry;
  if (!geom || geom.type !== 'MultiPolygon') return feature;

  const mainPolygons: number[][][][] = [];
  for (const polygon of (geom as GeoJSON.MultiPolygon).coordinates) {
    const outerRing = polygon[0];
    if (outerRing && outerRing.length > 0) {
      const lons = outerRing.map(p => p[0]);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      // Skip polygons that are near the dateline (±170° longitude)
      // or span more than 180° (indicating dateline crossing)
      const nearDateline = minLon < -170 || maxLon > 170;
      const spansWorld = (maxLon - minLon) > 180;

      if (!nearDateline && !spansWorld) {
        mainPolygons.push(polygon);
      }
    }
  }

  // If we filtered everything, return original (fallback)
  if (mainPolygons.length === 0) return feature;

  return {
    ...feature,
    geometry: {
      type: mainPolygons.length === 1 ? 'Polygon' : 'MultiPolygon',
      coordinates: mainPolygons.length === 1 ? mainPolygons[0] : mainPolygons,
    } as GeoJSON.Geometry,
  };
}

/**
 * Filter out overseas territories for World focus (e.g., French Guiana for France).
 * Only keeps polygons in the "main" region based on latitude/longitude clusters.
 */
function filterToMainlandOnly(feature: ExtendedFeature): ExtendedFeature {
  const geom = feature.geometry;
  if (!geom || geom.type !== 'MultiPolygon') return feature;

  const polygons = (geom as GeoJSON.MultiPolygon).coordinates;
  if (polygons.length <= 1) return feature;

  // Calculate centroid and area proxy for each polygon
  const polygonData = polygons.map((polygon, idx) => {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length === 0) return { idx, lon: 0, lat: 0, area: 0 };

    const lons = outerRing.map(p => p[0]);
    const lats = outerRing.map(p => p[1]);
    const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    // Use bounding box area as proxy for polygon size
    const area = (Math.max(...lons) - Math.min(...lons)) * (Math.max(...lats) - Math.min(...lats));

    return { idx, lon: avgLon, lat: avgLat, area };
  });

  // Find the largest polygon (likely the mainland)
  const largest = polygonData.reduce((a, b) => a.area > b.area ? a : b);

  // Keep polygons within 30 degrees of the largest polygon's centroid
  const nearbyPolygons = polygonData
    .filter(p => {
      const lonDiff = Math.abs(p.lon - largest.lon);
      const latDiff = Math.abs(p.lat - largest.lat);
      return lonDiff < 30 && latDiff < 30;
    })
    .map(p => polygons[p.idx]);

  if (nearbyPolygons.length === 0) return feature;

  return {
    ...feature,
    geometry: {
      type: nearbyPolygons.length === 1 ? 'Polygon' : 'MultiPolygon',
      coordinates: nearbyPolygons.length === 1 ? nearbyPolygons[0] : nearbyPolygons,
    } as GeoJSON.Geometry,
  };
}

/**
 * Compute [center, zoom] for a GeoJSON feature using the appropriate d3 projection.
 * Returns { center: [lng, lat], zoom } suitable for ZoomableGroup.
 */
export function computeFeatureZoom(
  feature: ExtendedFeature,
  focus: Focus,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): { center: [number, number]; zoom: number } {
  const defaultCenter = getDefaultCenter(focus);

  try {
    const baseProj = getD3Projection(focus, width, height);
    if (!baseProj) return { center: defaultCenter, zoom: 1 };

    // Apply appropriate filtering based on focus
    let featureToUse = feature;

    if (focus === 'europe') {
      // Filter to European bounds (exclude French Guiana, etc.)
      featureToUse = filterToEuropeanPolygons(featureToUse);
    }

    if (focus === 'world') {
      // For world map: filter out dateline-crossing polygons (Russia's far east)
      // and filter to mainland only (exclude overseas territories)
      featureToUse = filterOutDatelinePolygons(featureToUse);
      featureToUse = filterToMainlandOnly(featureToUse);
    }

    const pathGen = geoPath(baseProj);
    const bounds = pathGen.bounds(featureToUse as GeoPermissibleObjects);
    if (!bounds || !isFinite(bounds[0][0])) return { center: defaultCenter, zoom: 1 };

    const [[x0, y0], [x1, y1]] = bounds;
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw === 0 || bh === 0) return { center: defaultCenter, zoom: 1 };

    // Compute zoom to fit bounding box (factor controls how much viewport the feature fills)
    // factor=1.0 fills viewport, factor=0.5 fills half (more context visible)
    const ZOOM_FACTOR = 0.28;
    const rawZoom = Math.min((width * ZOOM_FACTOR) / bw, (height * ZOOM_FACTOR) / bh);
    // Clamp zoom between 1 (don't zoom out below default) and MAX_ZOOM (don't over-zoom tiny regions)
    const zoom = Math.max(1, Math.min(rawZoom, MAX_ZOOM));

    // Use geographic centroid directly for the center
    // This is more reliable than inverting screen coordinates
    const centroid = geoCentroid(featureToUse as GeoPermissibleObjects);
    const center: [number, number] = isFinite(centroid[0]) && isFinite(centroid[1])
      ? [centroid[0], centroid[1]]
      : defaultCenter;

    return { center, zoom };
  } catch {
    return { center: defaultCenter, zoom: 1 };
  }
}

/**
 * Compute union bounding box zoom for an array of features (drag-drop mode).
 * All features are from the same focus.
 */
export function computeUnionZoom(
  features: ExtendedFeature[],
  focus: Focus,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): { center: [number, number]; zoom: number } {
  const defaultCenter = getDefaultCenter(focus);

  if (features.length === 0) return { center: defaultCenter, zoom: 1 };
  if (features.length === 1) return computeFeatureZoom(features[0], focus, width, height);

  try {
    const baseProj = getD3Projection(focus, width, height);
    if (!baseProj) return { center: defaultCenter, zoom: 1 };

    const pathGen = geoPath(baseProj);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of features) {
      const b = pathGen.bounds(f as GeoPermissibleObjects);
      if (!b || !isFinite(b[0][0])) continue;
      if (b[0][0] < minX) minX = b[0][0];
      if (b[0][1] < minY) minY = b[0][1];
      if (b[1][0] > maxX) maxX = b[1][0];
      if (b[1][1] > maxY) maxY = b[1][1];
    }

    if (!isFinite(minX)) return { center: defaultCenter, zoom: 1 };

    const bw = maxX - minX;
    const bh = maxY - minY;
    const rawZoom = Math.min((width * 0.85) / bw, (height * 0.85) / bh);
    const zoom = Math.min(rawZoom, MAX_ZOOM);

    const inverted = baseProj.invert?.([(minX + maxX) / 2, (minY + maxY) / 2]);
    const center: [number, number] = inverted ?? defaultCenter;

    return { center, zoom };
  } catch {
    return { center: defaultCenter, zoom: 1 };
  }
}

// ─── D3 projection factory (used internally for bounds) ────────────────────

function getD3Projection(focus: Focus, width: number, height: number) {
  const tx = width / 2;
  const ty = height / 2;

  switch (focus) {
    case 'us':
      return geoAlbersUsa().scale(1000).translate([tx, ty]);
    case 'world':
      return geoNaturalEarth1().scale(147).translate([tx, ty]);
    case 'europe':
      return geoMercator().center([15, 54]).scale(600).translate([tx, ty]);
    default: {
      // Satisfy exhaustiveness; return identity as fallback
      const _: never = focus;
      void _;
      return geoIdentity();
    }
  }
}
