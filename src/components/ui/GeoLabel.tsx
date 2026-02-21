import type { GeoItem } from '../../types/geo';
import { formatLabel } from '../../lib/itemUtils';

interface GeoLabelProps {
  item: Pick<GeoItem, 'nameEn' | 'nameZh' | 'flagEmoji' | 'focus'>;
  className?: string;
}

/**
 * Renders the display label for a GeoItem.
 * Format: "Name (中文名) 🇫🇷" for countries
 * Format: "Name (中文名)" for non-countries
 */
export function GeoLabel({ item, className = '' }: GeoLabelProps) {
  const label = formatLabel(item);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{label}</span>
    </span>
  );
}
