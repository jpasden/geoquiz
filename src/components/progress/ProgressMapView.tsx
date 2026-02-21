import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import type { Focus } from '../../types/geo';
import type { GeoCard } from '../../types/geo';
import { getCardsByFocus } from '../../db/cardOps';
import { useMapLayer } from '../../hooks/useMapLayer';
import { PROJECTION_CONFIGS, MAP_WIDTH, MAP_HEIGHT } from '../../lib/projections';
import { RegionHighlightStyles } from '../maps/RegionHighlight';

// ── Mastery color scale per spec §9.5 ────────────────────────────────────

function masteryFill(card: GeoCard | undefined): string {
  if (!card || card.reps === 0) return '#D0D9E0'; // Unseen
  const d = card.scheduledDays;
  if (d <= 1)  return '#F4A261'; // Learning
  if (d <= 6)  return '#E9C46A'; // Familiar
  if (d <= 20) return '#90C987'; // Solid
  return '#2ECC71';              // Mastered
}

const LEGEND = [
  { color: '#D0D9E0', label: 'Not yet studied' },
  { color: '#F4A261', label: 'Learning (0–1d)' },
  { color: '#E9C46A', label: 'Familiar (2–6d)' },
  { color: '#90C987', label: 'Solid (7–20d)' },
  { color: '#2ECC71', label: 'Mastered (21+d)' },
];

interface ProgressMapViewProps {
  focus: Focus;
}

export function ProgressMapView({ focus }: ProgressMapViewProps) {
  const [cardMap, setCardMap] = useState<Map<string, GeoCard>>(new Map());
  const { regions, loading } = useMapLayer(focus);

  // Load all cards for this focus
  useEffect(() => {
    getCardsByFocus(focus)
      .then((cards) => setCardMap(new Map(cards.map((c) => [c.id, c]))))
      .catch(console.error);
  }, [focus]);

  const cfg = PROJECTION_CONFIGS[focus];
  const defaultCenter: [number, number] = focus === 'europe' ? [15, 54] : [0, 0];

  if (loading) {
    return <div className="py-8 text-center text-slate-400 text-sm">Loading map…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <RegionHighlightStyles />

      {/* Map */}
      <div className="rounded-xl overflow-hidden bg-slate-100 shadow-sm">
        <ComposableMap
          projection={cfg.projection}
          projectionConfig={cfg.projectionConfig}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          style={{ width: '100%', height: 'auto' }}
        >
          <ZoomableGroup center={defaultCenter} zoom={1}>
            <Geographies geography={regions}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  // Build matching item id
                  const p = geo.properties as Record<string, unknown>;
                  const slug =
                    (p.STUSPS as string) ??
                    (p.ISO_A3 as string) ??
                    (p.GID_1 as string) ??
                    String(p.NAME ?? '');
                  const id = `${focus}-region-${slug.toLowerCase()}`;
                  const card = cardMap.get(id);
                  const fill = masteryFill(card);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#3D5166"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover:   { outline: 'none', opacity: 0.85 },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map(({ color, label }) => (
          <div key={color} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
