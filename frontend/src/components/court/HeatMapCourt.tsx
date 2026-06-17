import { useState } from 'react';
import clsx from 'clsx';
import type { HeatmapData } from '../../types';

const ZONE_RECTS: Record<number, { x: number; y: number; w: number; h: number }> = {
  4: { x: 0,   y: 0,   w: 100, h: 100 },
  3: { x: 100, y: 0,   w: 100, h: 100 },
  2: { x: 200, y: 0,   w: 100, h: 100 },
  5: { x: 0,   y: 100, w: 100, h: 100 },
  6: { x: 100, y: 100, w: 100, h: 100 },
  1: { x: 200, y: 100, w: 100, h: 100 },
};

const HEATMAP_TYPES = [
  { key: 'attack',  label: 'Attack',   description: 'Kills, errors & attempts', color: '#ef4444' },
  { key: 'serve',   label: 'Serve',    description: 'Aces, errors & in-serves', color: '#3b82f6' },
  { key: 'pass',    label: 'Pass',     description: 'Pass ratings 0–3',         color: '#8b5cf6' },
  { key: 'block',   label: 'Block',    description: 'Solo blocks, assists & errors', color: '#10b981' },
  { key: 'defence', label: 'Defence',  description: 'Digs & dig errors',        color: '#f59e0b' },
  { key: 'all',     label: 'All',      description: 'Every event with a zone',  color: '#94a3b8' },
] as const;

type HeatmapType = typeof HEATMAP_TYPES[number];

interface Props {
  data: HeatmapData;
  title?: string;
}

function ZoneCell({
  zone,
  count,
  max,
  color,
  hoveredZone,
  onHover,
}: {
  zone: number;
  count: number;
  max: number;
  color: string;
  hoveredZone: number | null;
  onHover: (zone: number | null) => void;
}) {
  const { x, y, w, h } = ZONE_RECTS[zone];
  const intensity = max > 0 && count > 0 ? count / max : 0;
  // Scale opacity: min 0.08 when there are events, up to 0.85 at max
  const fillOpacity = count > 0 ? 0.08 + intensity * 0.77 : 0;
  const isHovered = hoveredZone === zone;

  return (
    <g
      onMouseEnter={() => onHover(zone)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'default' }}
    >
      <rect
        x={x} y={y} width={w} height={h}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={isHovered ? '#fbbf24' : '#162d58'}
        strokeWidth={isHovered ? 2 : 1}
      />
      {/* Zone label */}
      <text
        x={x + w / 2} y={y + h / 2 - 10}
        textAnchor="middle"
        fill={count > 0 ? '#94a3b8' : '#334155'}
        fontSize="16"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {zone}
      </text>
      {/* Count */}
      <text
        x={x + w / 2} y={y + h / 2 + 10}
        textAnchor="middle"
        fill={count > 0 ? '#f0f4f8' : '#334155'}
        fontSize="12"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {count > 0 ? count : '0'}
      </text>
      {/* Percentage */}
      {count > 0 && (
        <text
          x={x + w / 2} y={y + h / 2 + 24}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontFamily="monospace"
        >
          {Math.round(intensity * 100)}%
        </text>
      )}
    </g>
  );
}

export default function HeatMapCourt({ data, title }: Props) {
  const [activeType, setActiveType] = useState<HeatmapType>(HEATMAP_TYPES[0]);
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);

  const counts = data[activeType.key] ?? {};
  const max = Math.max(...Object.values(counts), 1);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const hotZone = total > 0
    ? Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0])
    : null;

  return (
    <div className="card p-4 space-y-4">
      {title && <h3 className="font-semibold text-chalk-100">{title}</h3>}

      {/* Heat map type selector */}
      <div className="flex flex-wrap gap-2">
        {HEATMAP_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => setActiveType(type)}
            className={clsx(
              'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
              activeType.key === type.key
                ? 'text-court-950 border-transparent'
                : 'bg-court-800 text-chalk-400 border-court-700 hover:border-chalk-500'
            )}
            style={
              activeType.key === type.key
                ? { backgroundColor: type.color, borderColor: type.color }
                : {}
            }
          >
            {type.label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="text-sm text-chalk-500 text-center py-8 border border-dashed border-court-700 rounded-xl">
          No zone data for this category yet.<br />
          <span className="text-xs text-chalk-600">Select a court zone when recording events.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Court heat map */}
          <div className="relative">
            <svg
              viewBox="0 0 300 200"
              className="w-full max-w-md mx-auto rounded-xl overflow-hidden"
              style={{ aspectRatio: '3/2' }}
            >
              <rect x="0" y="0" width="300" height="200" fill="#0a1628" />

              {([4, 3, 2, 5, 6, 1] as const).map((zone) => (
                <ZoneCell
                  key={zone}
                  zone={zone}
                  count={counts[String(zone)] ?? 0}
                  max={max}
                  color={activeType.color}
                  hoveredZone={hoveredZone}
                  onHover={setHoveredZone}
                />
              ))}

              {/* Net */}
              <line x1="0" y1="100" x2="300" y2="100" stroke="#f59e0b" strokeWidth="2" opacity="0.5" />
              <text x="150" y="97" textAnchor="middle" fill="#f59e0b" fontSize="7" opacity="0.5" letterSpacing="3">NET</text>

              <rect x="0" y="0" width="300" height="200" fill="none" stroke="#162d58" strokeWidth="2" />
            </svg>
          </div>

          {/* Legend + summary */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Colour scale legend */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
              <span className="text-xs text-chalk-500">Low</span>
              <div
                className="flex-1 h-2.5 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${activeType.color}14, ${activeType.color}cc)`,
                }}
              />
              <span className="text-xs text-chalk-500">High</span>
            </div>
            <div className="text-xs text-chalk-400 shrink-0">
              {total} events · {activeType.description}
            </div>
          </div>

          {/* Hover tooltip or hot-zone insight */}
          {hoveredZone ? (
            <div className="rounded-lg bg-court-800 border border-court-700 px-3 py-2 text-sm">
              <span className="font-mono text-spike-400">Zone {hoveredZone}</span>
              <span className="text-chalk-400 ml-2">
                {counts[String(hoveredZone)] ?? 0} events
                {total > 0 && (
                  <> · {Math.round(((counts[String(hoveredZone)] ?? 0) / total) * 100)}% of total</>
                )}
              </span>
            </div>
          ) : hotZone != null ? (
            <div className="rounded-lg bg-court-800 border border-court-700 px-3 py-2 text-sm text-chalk-400">
              Highest activity in <span className="font-mono text-spike-400">Zone {hotZone}</span>
              {' '}({counts[String(hotZone)]} events · {Math.round((counts[String(hotZone)] / total) * 100)}%)
              — hover a zone for details
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
