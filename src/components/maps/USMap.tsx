import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import { PROJECTION_CONFIGS, MAP_WIDTH, MAP_HEIGHT } from '../../lib/projections';
import type { ZoomState } from '../../hooks/useAutoZoom';
import type { GeoItem } from '../../types/geo';

// Visual state colors from spec §9.3
export const MAP_COLORS = {
  default: '#EEF4F7',
  hover: '#C8DDE8',
  active: '#FCE6C2',        // Light peach/cream for active target
  activeHover: '#F5A623',   // Darker orange on hover
  correct: '#2ECC71',
  incorrect: '#E74C3C',     // Red for incorrect
  answered: '#A8D5B5',
  stroke: '#3D5166',
  ocean: '#D4E6F1',
  /** Grayed out background regions (non-quizzable context) */
  background: '#D8DFE3',
  backgroundStroke: '#B8C4CC',
} as const;

interface BaseMapProps {
  geoData: GeoJSON.FeatureCollection;
  /** Background geography data (grayed out, non-interactive context) */
  backgroundGeoData?: GeoJSON.FeatureCollection;
  /** Item id of the currently active (quiz target) feature */
  activeId?: string | null;
  /** Item ids that have been answered correctly */
  correctIds?: Set<string>;
  /** Item ids that have been answered incorrectly (shown briefly) */
  incorrectIds?: Set<string>;
  /** Zoom/center state from useAutoZoom */
  zoomState?: ZoomState | null;
  /** Called when a region is clicked (for optional interactivity) */
  onRegionClick?: (id: string) => void;
  /** Called when zoom/pan ends (for tracking actual zoom level) */
  onMoveEnd?: (position: { zoom: number; coordinates: [number, number] }) => void;
  /** Whether the map is in drag-drop mode (all targets visible simultaneously) */
  dragDropMode?: boolean;
  /** All items for this focus (used for labels and flag hints) */
  items?: GeoItem[];
  /** The currently active GeoItem (for flag hint on hover) */
  activeItem?: GeoItem | null;
  children?: React.ReactNode;
}

/**
 * Build a map id from feature properties, matching the format in itemUtils.ts:
 * "us-region-CA", "world-region-FRA", "europe-region-france"
 */
function featureId(
  focus: 'us' | 'world' | 'europe',
  props: Record<string, unknown>,
): string {
  // For Europe, some countries have invalid ISO_A3 ("-99"), fall back to NAME
  const isoCode = String(props.ISO_A3 ?? '');
  const validIso = isoCode && !isoCode.startsWith('-') ? isoCode : '';

  const slug =
    (props.STUSPS as string) ??
    (focus === 'europe' ? (validIso || String(props.NAME ?? '')) : (props.ISO_A3 as string)) ??
    (props.GID_1 as string) ??
    String(props.NAME ?? '');
  return `${focus}-region-${slug.toLowerCase()}`;
}

function getFeatureFill(id: string, props: BaseMapProps): string {
  if (props.correctIds?.has(id)) return MAP_COLORS.correct;
  if (props.incorrectIds?.has(id)) return MAP_COLORS.incorrect;
  if (props.activeId === id) return MAP_COLORS.active;
  return MAP_COLORS.default;
}

// ─── Europe filtering helpers ─────────────────────────────────────────────

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
 * Filter a GeoJSON FeatureCollection to only include polygons within European bounds.
 * For MultiPolygons (like France with French Guiana, or Russia spanning to lon 180),
 * filters out non-European parts using the western edge of each polygon.
 * This correctly handles Russia: its western edge starts at lon ~27 (in Europe)
 * even though it extends to lon 180.
 */
function filterToEuropeOnly(geoData: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    ...geoData,
    features: geoData.features.map((feature) => {
      const geom = feature.geometry;
      if (!geom) return feature;

      if (geom.type === 'MultiPolygon') {
        const europeanPolygons: number[][][][] = [];
        for (const polygon of geom.coordinates) {
          const outerRing = polygon[0];
          if (outerRing && outerRing.length > 0) {
            const lons = outerRing.map((p) => p[0]);
            const lats = outerRing.map((p) => p[1]);
            const minLon = Math.min(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            // Keep polygon if its western edge is within European longitude bounds
            // and it has overlap with European latitudes.
            if (
              minLon <= EUROPE_BOUNDS.maxLon &&
              maxLat >= EUROPE_BOUNDS.minLat &&
              minLat <= EUROPE_BOUNDS.maxLat
            ) {
              europeanPolygons.push(polygon);
            }
          }
        }
        // If we filtered some polygons, return modified feature
        if (europeanPolygons.length > 0 && europeanPolygons.length < geom.coordinates.length) {
          return {
            ...feature,
            geometry: {
              type: europeanPolygons.length === 1 ? 'Polygon' : 'MultiPolygon',
              coordinates: europeanPolygons.length === 1 ? europeanPolygons[0] : europeanPolygons,
            } as GeoJSON.Geometry,
          };
        }
      }

      return feature;
    }),
  };
}

// ─── USMap ────────────────────────────────────────────────────────────────

export function USMap({ geoData, activeId, correctIds, incorrectIds, zoomState, onRegionClick, onMoveEnd, items, children }: BaseMapProps) {
  const cfg = PROJECTION_CONFIGS.us;
  const center = zoomState?.center ?? [0, 0];
  const zoom = zoomState?.zoom ?? 1;

  // Track which region is being hovered (for consistent active hover behavior)
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Items with labels (correctly answered regions)
  const labeledItems = useMemo(() => {
    if (!items || !correctIds) return [];
    return items.filter(item => correctIds.has(item.id));
  }, [items, correctIds]);

  // Scale for labels based on zoom
  const labelScale = Math.max(0.4, Math.min(1.2, 1 / Math.sqrt(zoom)));
  const fontSize = 11 * labelScale;

  return (
    <ComposableMap
      projection={cfg.projection}
      projectionConfig={cfg.projectionConfig}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      style={{ width: '100%', height: 'auto', background: MAP_COLORS.ocean }}
    >
      <ZoomableGroup center={center} zoom={zoom} maxZoom={8} onMoveEnd={onMoveEnd}>
        <Geographies geography={geoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = featureId('us', geo.properties as Record<string, unknown>);
              const fill = getFeatureFill(id, { geoData, activeId, correctIds, incorrectIds });
              const isActive = activeId === id;
              const isHovered = hoveredId === id;
              const hoverFill = isActive ? MAP_COLORS.activeHover : MAP_COLORS.hover;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered && isActive ? MAP_COLORS.activeHover : fill}
                  stroke={MAP_COLORS.stroke}
                  strokeWidth={0.5}
                  className={isActive ? 'geo-pulse' : undefined}
                  style={{
                    default: { outline: 'none', cursor: onRegionClick ? 'pointer' : 'default' },
                    hover: { fill: hoverFill, outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onRegionClick?.(id)}
                />
              );
            })
          }
        </Geographies>

        {/* Region labels for correctly answered states */}
        {labeledItems.map((item) => {
          const feature = geoData.features.find(f => {
            const id = featureId('us', f.properties as Record<string, unknown>);
            return id === item.id;
          });
          if (!feature) return null;
          const centroid = geoCentroid(feature as GeoJSON.Feature);
          if (!isFinite(centroid[0]) || !isFinite(centroid[1])) return null;

          return (
            <Marker key={item.id} coordinates={centroid as [number, number]}>
              <text
                textAnchor="middle"
                y={4}
                style={{
                  fontSize,
                  fontWeight: 600,
                  fill: 'white',
                  stroke: 'white',
                  strokeWidth: 3,
                  strokeLinejoin: 'round',
                  pointerEvents: 'none',
                }}
              >
                {item.nameEn}
              </text>
              <text
                textAnchor="middle"
                y={4}
                style={{
                  fontSize,
                  fontWeight: 600,
                  fill: '#1e293b',
                  pointerEvents: 'none',
                }}
              >
                {item.nameEn}
              </text>
            </Marker>
          );
        })}

        {children}
      </ZoomableGroup>
    </ComposableMap>
  );
}

// ─── WorldMap ─────────────────────────────────────────────────────────────

export function WorldMap({ geoData, activeId, correctIds, incorrectIds, zoomState, onRegionClick, onMoveEnd, items, activeItem, children }: BaseMapProps) {
  const cfg = PROJECTION_CONFIGS.world;
  const center = zoomState?.center ?? [0, 0];
  const zoom = zoomState?.zoom ?? 1;

  // Track which region is being hovered
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Scale for labels based on zoom
  const labelScale = Math.max(0.4, Math.min(1.2, 1 / Math.sqrt(zoom)));
  const fontSize = 11 * labelScale;

  // Build a lookup from item id → item for hover label
  const itemMap = useMemo(() => {
    if (!items) return new Map<string, GeoItem>();
    return new Map(items.map(i => [i.id, i]));
  }, [items]);

  // Find the feature being hovered (for both flag hint and name label)
  const hoveredFeature = useMemo(() => {
    if (!hoveredId) return null;
    return geoData.features.find(f => {
      const id = featureId('world', f.properties as Record<string, unknown>);
      return id === hoveredId;
    });
  }, [hoveredId, geoData]);

  const hoveredCentroid = useMemo(() => {
    if (!hoveredFeature) return null;
    const c = geoCentroid(hoveredFeature as GeoJSON.Feature);
    return isFinite(c[0]) && isFinite(c[1]) ? c as [number, number] : null;
  }, [hoveredFeature]);

  // Show flag hint when hovering the active (quiz target) region
  const showFlagHint = hoveredId === activeId;
  // Show name label when hovering a correctly-answered region (not the active one)
  const showNameLabel = hoveredId !== null && hoveredId !== activeId && correctIds?.has(hoveredId);

  return (
    <ComposableMap
      projection={cfg.projection}
      projectionConfig={cfg.projectionConfig}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      style={{ width: '100%', height: 'auto', background: MAP_COLORS.ocean }}
    >
      <ZoomableGroup center={center} zoom={zoom} maxZoom={8} onMoveEnd={onMoveEnd}>
        <Geographies geography={geoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = featureId('world', geo.properties as Record<string, unknown>);
              const fill = getFeatureFill(id, { geoData, activeId, correctIds, incorrectIds });
              const isActive = activeId === id;
              const isHovered = hoveredId === id;
              const hoverFill = isActive ? MAP_COLORS.activeHover : MAP_COLORS.hover;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered && isActive ? MAP_COLORS.activeHover : fill}
                  stroke={MAP_COLORS.stroke}
                  strokeWidth={0.5}
                  className={isActive ? 'geo-pulse' : undefined}
                  style={{
                    default: { outline: 'none', cursor: onRegionClick ? 'pointer' : 'default' },
                    hover: { fill: hoverFill, outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onRegionClick?.(id)}
                />
              );
            })
          }
        </Geographies>

        {/* Flag hint when hovering the active (quiz target) region */}
        {hoveredCentroid && showFlagHint && activeItem?.flagEmoji && (
          <Marker coordinates={hoveredCentroid}>
            <text
              textAnchor="middle"
              y={5}
              style={{
                fontSize: 28 * labelScale,
                pointerEvents: 'none',
              }}
            >
              {activeItem.flagEmoji}
            </text>
          </Marker>
        )}

        {/* Name label when hovering a correctly-answered country */}
        {hoveredCentroid && showNameLabel && hoveredId && (
          <Marker coordinates={hoveredCentroid}>
            <text
              textAnchor="middle"
              y={4}
              style={{
                fontSize,
                fontWeight: 600,
                fill: 'white',
                stroke: 'white',
                strokeWidth: 3,
                strokeLinejoin: 'round',
                paintOrder: 'stroke',
                pointerEvents: 'none',
              }}
            >
              {itemMap.get(hoveredId)?.nameEn}
            </text>
            <text
              textAnchor="middle"
              y={4}
              style={{
                fontSize,
                fontWeight: 600,
                fill: '#1e293b',
                pointerEvents: 'none',
              }}
            >
              {itemMap.get(hoveredId)?.nameEn}
            </text>
          </Marker>
        )}

        {children}
      </ZoomableGroup>
    </ComposableMap>
  );
}

// ─── EuropeMap ────────────────────────────────────────────────────────────

export function EuropeMap({ geoData, backgroundGeoData, activeId, correctIds, incorrectIds, zoomState, onRegionClick, onMoveEnd, items, activeItem, children }: BaseMapProps) {
  const cfg = PROJECTION_CONFIGS.europe;
  const center = zoomState?.center ?? [15, 54];
  const zoom = zoomState?.zoom ?? 1;

  // Track which region is being hovered
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Filter out overseas territories (e.g., French Guiana) from the Europe map
  const filteredGeoData = useMemo(() => filterToEuropeOnly(geoData), [geoData]);

  // Items with labels (correctly answered regions)
  const labeledItems = useMemo(() => {
    if (!items || !correctIds) return [];
    return items.filter(item => correctIds.has(item.id));
  }, [items, correctIds]);

  // Scale for labels based on zoom
  const labelScale = Math.max(0.4, Math.min(1.2, 1 / Math.sqrt(zoom)));
  const fontSize = 11 * labelScale;

  // Find centroid for flag hint on active region hover
  const activeFeature = useMemo(() => {
    if (!activeId || hoveredId !== activeId) return null;
    return filteredGeoData.features.find(f => {
      const id = featureId('europe', f.properties as Record<string, unknown>);
      return id === activeId;
    });
  }, [activeId, hoveredId, filteredGeoData]);

  const activeCentroid = useMemo(() => {
    if (!activeFeature) return null;
    const c = geoCentroid(activeFeature as GeoJSON.Feature);
    return isFinite(c[0]) && isFinite(c[1]) ? c as [number, number] : null;
  }, [activeFeature]);

  return (
    <ComposableMap
      projection={cfg.projection}
      projectionConfig={cfg.projectionConfig}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      style={{ width: '100%', height: 'auto', background: MAP_COLORS.ocean }}
    >
      <ZoomableGroup center={center} zoom={zoom} maxZoom={8} onMoveEnd={onMoveEnd}>
        {/* Background layer: world countries grayed out for context */}
        {backgroundGeoData && (
          <Geographies geography={backgroundGeoData}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={MAP_COLORS.background}
                  stroke={MAP_COLORS.backgroundStroke}
                  strokeWidth={0.3}
                  style={{
                    default: { outline: 'none', pointerEvents: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
        )}
        {/* Foreground layer: Europe countries (quizzable, filtered to exclude overseas territories) */}
        <Geographies geography={filteredGeoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = featureId('europe', geo.properties as Record<string, unknown>);
              const fill = getFeatureFill(id, { geoData: filteredGeoData, activeId, correctIds, incorrectIds });
              const isActive = activeId === id;
              const isHovered = hoveredId === id;
              // For active region: light orange default, darker orange on hover
              const hoverFill = isActive ? MAP_COLORS.activeHover : MAP_COLORS.hover;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered && isActive ? MAP_COLORS.activeHover : fill}
                  stroke={MAP_COLORS.stroke}
                  strokeWidth={0.5}
                  className={isActive ? 'geo-pulse' : undefined}
                  style={{
                    default: { outline: 'none', cursor: onRegionClick ? 'pointer' : 'default' },
                    hover: { fill: hoverFill, outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onRegionClick?.(id)}
                />
              );
            })
          }
        </Geographies>

        {/* Flag hint on active region hover */}
        {activeCentroid && activeItem?.flagEmoji && (
          <Marker coordinates={activeCentroid}>
            <text
              textAnchor="middle"
              y={5}
              style={{
                fontSize: 28 * labelScale,
                pointerEvents: 'none',
              }}
            >
              {activeItem.flagEmoji}
            </text>
          </Marker>
        )}

        {/* Region labels for correctly answered countries */}
        {labeledItems.map((item) => {
          const feature = filteredGeoData.features.find(f => {
            const id = featureId('europe', f.properties as Record<string, unknown>);
            return id === item.id;
          });
          if (!feature) return null;
          const centroid = geoCentroid(feature as GeoJSON.Feature);
          if (!isFinite(centroid[0]) || !isFinite(centroid[1])) return null;

          return (
            <Marker key={item.id} coordinates={centroid as [number, number]}>
              {/* White outline for readability */}
              <text
                textAnchor="middle"
                y={4}
                style={{
                  fontSize,
                  fontWeight: 600,
                  fill: 'white',
                  stroke: 'white',
                  strokeWidth: 3,
                  strokeLinejoin: 'round',
                  pointerEvents: 'none',
                }}
              >
                {item.nameEn}
              </text>
              {/* Foreground text */}
              <text
                textAnchor="middle"
                y={4}
                style={{
                  fontSize,
                  fontWeight: 600,
                  fill: '#1e293b',
                  pointerEvents: 'none',
                }}
              >
                {item.nameEn}
              </text>
            </Marker>
          );
        })}

        {children}
      </ZoomableGroup>
    </ComposableMap>
  );
}
