/**
 * RegionHighlight injects the CSS pulse animation for active region polygons.
 * The actual styling is applied via the `geo-pulse` className on the Geography element.
 * This component renders the keyframe styles into a <style> tag once.
 */
export function RegionHighlightStyles() {
  return (
    <style>{`
      /* Active region polygon glow effect - softer peach/orange glow */
      .geo-pulse {
        animation: geo-region-glow 1.5s ease-in-out infinite;
        filter: drop-shadow(0 0 6px #F5A623) drop-shadow(0 0 12px #FCE6C2);
      }
      @keyframes geo-region-glow {
        0%, 100% {
          filter: drop-shadow(0 0 4px #F5A623) drop-shadow(0 0 8px #FCE6C2);
        }
        50% {
          filter: drop-shadow(0 0 8px #F5A623) drop-shadow(0 0 16px #FCE6C2) drop-shadow(0 0 24px rgba(252,230,194,0.6));
        }
      }

      /* Active point marker pulsing ring */
      .point-pulse-ring {
        animation: point-ring-pulse 1.2s ease-out infinite;
      }
      @keyframes point-ring-pulse {
        0%   { r: 8; opacity: 0.9; }
        100% { r: 20; opacity: 0; }
      }

      /* Correct reveal — 1.5s green flash */
      .geo-correct-flash {
        animation: geo-correct 1.5s ease-out forwards;
      }
      @keyframes geo-correct {
        0%   { fill: #2ECC71; }
        100% { fill: #EEF4F7; }
      }

      /* Incorrect reveal - red flash */
      .geo-incorrect-flash {
        animation: geo-incorrect 1.5s ease-out forwards;
      }
      @keyframes geo-incorrect {
        0%   { fill: #E74C3C; }
        100% { fill: #EEF4F7; }
      }
    `}</style>
  );
}
