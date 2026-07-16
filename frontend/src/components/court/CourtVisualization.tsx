import { useState } from 'react';
import clsx from 'clsx';
import type { ZoneCounts } from '../../types';
import { CHART_SERIES, CHART_GRID, CHART_TICK, CHART_EMPTY, CHART_TOOLTIP_BG } from '../../lib/chartColors';

// Heat intensity scales GOLD opacity on navy (brand accent).
const HEAT_COLOR = CHART_SERIES[0];
const HEAT_RGB = '255,184,28'; // gold-500 as r,g,b for rgba() fills

// Zone layout positions on the SVG court
// Court is 300×200. Zones share the space:
//   front row (zones 4,3,2): y 0–100
//   back row  (zones 5,6,1): y 100–200
const ZONE_RECTS: Record<number, { x: number; y: number; w: number; h: number }> = {
  4: { x: 0,   y: 0,   w: 100, h: 100 },
  3: { x: 100, y: 0,   w: 100, h: 100 },
  2: { x: 200, y: 0,   w: 100, h: 100 },
  5: { x: 0,   y: 100, w: 100, h: 100 },
  6: { x: 100, y: 100, w: 100, h: 100 },
  1: { x: 200, y: 100, w: 100, h: 100 },
};

const CATEGORIES = [
  { key: 'all',     label: 'All Events' },
  { key: 'attack',  label: 'Kills / Attacks' },
  { key: 'serve',   label: 'Serves' },
  { key: 'pass',    label: 'Passes' },
  { key: 'block',   label: 'Blocks' },
  { key: 'defence', label: 'Digs' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

interface Props {
  // heatmapData: per-category zone counts
  heatmapData: Record<string, ZoneCounts>;
  title?: string;
}

export default function CourtVisualization({ heatmapData, title }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const counts = heatmapData[activeCategory] ?? {};
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const max = Math.max(...Object.values(counts), 1);

  return (
    <div className="card p-4 space-y-4">
      {title && <h3 className="font-semibold text-chalk-100">{title}</h3>}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={clsx(
              'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
              activeCategory === key
                ? 'bg-spike-500 text-navy-900 border-spike-400'
                : 'bg-court-800 text-chalk-400 border-court-700 hover:border-chalk-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="text-sm text-chalk-500 text-center py-6">
          No zone data recorded yet — select a court zone when tracking events.
        </div>
      ) : (
        <div className="flex gap-4 items-start flex-wrap">
          {/* Court SVG */}
          <div className="flex-1 min-w-[200px]">
            <svg
              viewBox="0 0 300 200"
              className="w-full max-w-sm mx-auto"
              style={{ aspectRatio: '3/2' }}
            >
              {/* Court background */}
              <rect x="0" y="0" width="300" height="200" fill={CHART_TOOLTIP_BG} rx="4" />

              {/* Zone rectangles */}
              {([4, 3, 2, 5, 6, 1] as const).map((zone) => {
                const { x, y, w, h } = ZONE_RECTS[zone];
                const count = counts[String(zone)] ?? 0;
                const opacity = count > 0 ? 0.15 + (count / max) * 0.5 : 0;
                return (
                  <g key={zone}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill={`rgba(${HEAT_RGB},${opacity})`}
                      stroke={CHART_GRID}
                      strokeWidth="1"
                    />
                    {/* Zone number */}
                    <text
                      x={x + w / 2} y={y + h / 2 - 8}
                      textAnchor="middle"
                      fill={CHART_TICK}
                      fontSize="18"
                      fontFamily="Inter, sans-serif"
                      fontWeight="bold"
                    >
                      {zone}
                    </text>
                    {/* Event count */}
                    <text
                      x={x + w / 2} y={y + h / 2 + 12}
                      textAnchor="middle"
                      fill={count > 0 ? HEAT_COLOR : CHART_EMPTY}
                      fontSize="13"
                      fontFamily="Inter, sans-serif"
                      fontWeight="bold"
                    >
                      {count > 0 ? count : '—'}
                    </text>
                  </g>
                );
              })}

              {/* Net line */}
              <line x1="0" y1="100" x2="300" y2="100" stroke={HEAT_COLOR} strokeWidth="2" opacity="0.6" />
              <text x="150" y="97" textAnchor="middle" fill={HEAT_COLOR} fontSize="8" opacity="0.5" letterSpacing="3">
                NET
              </text>

              {/* Court border */}
              <rect x="0" y="0" width="300" height="200" fill="none" stroke={CHART_GRID} strokeWidth="2" rx="4" />
            </svg>
          </div>

          {/* Zone breakdown list */}
          <div className="flex-1 min-w-[140px] space-y-2">
            <p className="text-xs text-chalk-400 font-medium">Zone breakdown</p>
            {([4, 3, 2, 5, 6, 1] as const).map((zone) => {
              const count = counts[String(zone)] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={zone} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-chalk-400 w-12">Zone {zone}</span>
                  <div className="flex-1 bg-court-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-spike-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-chalk-200 w-8 text-right">{count}</span>
                </div>
              );
            })}
            <p className="text-xs text-chalk-600 pt-1">Total: {total} events</p>
          </div>
        </div>
      )}
    </div>
  );
}
