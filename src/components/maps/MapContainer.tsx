import { useMemo, useState, useEffect } from 'react';
import type { Focus, GeoItem } from '../../types/geo';
import { useMapLayer } from '../../hooks/useMapLayer';
import { useAutoZoom } from '../../hooks/useAutoZoom';
import { USMap, WorldMap, EuropeMap } from './USMap';
import { RegionHighlightStyles } from './RegionHighlight';

// Cache for background world data (loaded once for Europe context)
let worldBackgroundCache: GeoJSON.FeatureCollection | null = null;

interface MapContainerProps {
  /** The focus whose base map to render */
  focus: Focus;
  /** Active quiz target item id (for highlighting) */
  activeItemId?: string | null;
  /** Ids correctly answered in the current session */
  correctIds?: Set<string>;
  /** Ids answered incorrectly (brief flash) */
  incorrectIds?: Set<string>;
  /** Called when a region polygon is clicked */
  onRegionClick?: (id: string) => void;
  /** Override zoom state */
  zoomOverride?: { center: [number, number]; zoom: number };
  /** When true, suppresses flag hints on hover (used during quiz to prevent cheating) */
  inQuizMode?: boolean;
  /** Extra SVG content rendered inside the ZoomableGroup */
  children?: React.ReactNode;
}

export function MapContainer({
  focus,
  activeItemId,
  correctIds,
  incorrectIds,
  onRegionClick,
  zoomOverride,
  inQuizMode,
  children,
}: MapContainerProps) {
  const { regions, items, loading, error } = useMapLayer(focus);

  // Load world background data for Europe focus (shows Africa, Middle East as context)
  const [worldBackground, setWorldBackground] = useState<GeoJSON.FeatureCollection | null>(worldBackgroundCache);
  useEffect(() => {
    if (focus === 'europe' && !worldBackgroundCache) {
      import('../../data/world-countries.json').then((mod) => {
        worldBackgroundCache = mod.default as unknown as GeoJSON.FeatureCollection;
        setWorldBackground(worldBackgroundCache);
      });
    }
  }, [focus]);

  // Find the active GeoItem from the registry
  const activeItem = useMemo<GeoItem | null>(
    () => (activeItemId ? (items.find((i) => i.id === activeItemId) ?? null) : null),
    [activeItemId, items],
  );

  // Auto-zoom based on the active item (unless overridden)
  const autoZoom = useAutoZoom(activeItem, regions, focus);
  const zoomState = zoomOverride ?? autoZoom;

  // Show loading state while map data or zoom is being computed
  // This prevents the flash of wrong zoom level
  const zoomReady = zoomState !== null || !activeItemId;

  if (loading || !zoomReady) {
    return (
      <div className="flex items-center justify-center w-full h-64 bg-slate-100 rounded-xl">
        <span className="text-slate-400 text-sm">Loading map…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-64 bg-red-50 rounded-xl">
        <span className="text-red-500 text-sm">Map error: {error}</span>
      </div>
    );
  }

  const mapProps = {
    geoData: regions,
    activeId: activeItemId,
    correctIds,
    incorrectIds,
    zoomState,
    onRegionClick,
    items,
    // Suppress activeItem (flag hint) during quiz to avoid giving away the answer
    activeItem: inQuizMode ? null : activeItem,
    children,
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-slate-100 shadow-sm">
      <RegionHighlightStyles />
      {focus === 'us' && <USMap {...mapProps} />}
      {focus === 'world' && <WorldMap {...mapProps} />}
      {focus === 'europe' && <EuropeMap {...mapProps} backgroundGeoData={worldBackground ?? undefined} />}
    </div>
  );
}
