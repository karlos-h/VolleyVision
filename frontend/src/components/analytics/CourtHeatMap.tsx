import { useState } from 'react';
import clsx from 'clsx';
import type { DetailedHeatmapData, ZoneAttack, ZoneServe, ZonePass, ZoneDefence } from '../../types';
import { CHART_SERIES, CHART_POSITIVE, CHART_NEGATIVE } from '../../lib/chartColors';

// Standard volleyball zone layout:
//   4 | 3 | 2   ← front row
//   5 | 6 | 1   ← back row
const ZONE_LAYOUT = [
  [4, 3, 2],
  [5, 6, 1],
] as const;

type Category = 'attack' | 'serve' | 'pass' | 'defence';

const CATEGORIES: { key: Category; label: string; color: string; description: string }[] = [
  { key: 'attack',  label: 'Attack',  color: CHART_NEGATIVE,  description: 'hitting %' },
  { key: 'serve',   label: 'Serve',   color: CHART_SERIES[2], description: 'efficiency' },
  { key: 'pass',    label: 'Pass',    color: CHART_SERIES[3], description: 'rating / 3.0' },
  { key: 'defence', label: 'Defence', color: CHART_POSITIVE,  description: 'total contacts' },
];

function zoneVolume(zone: string, data: DetailedHeatmapData, category: Category): number {
  switch (category) {
    case 'attack':  return data.attack[zone]?.attempts ?? 0;
    case 'serve':   return data.serve[zone]?.attempts ?? 0;
    case 'pass':    return data.pass[zone]?.attempts ?? 0;
    case 'defence': return data.defence[zone]?.total ?? 0;
  }
}

function ZoneCell({ zone, data, category, color }: {
  zone: number;
  data: DetailedHeatmapData;
  category: Category;
  color: string;
}) {
  const z = String(zone);
  const volume = zoneVolume(z, data, category);
  const allVolumes = ['1','2','3','4','5','6'].map((z2) => zoneVolume(z2, data, category));
  const maxVolume = Math.max(...allVolumes, 1);
  const intensity = volume > 0 ? 0.08 + (volume / maxVolume) * 0.72 : 0;

  let primary = '';
  let secondary = '';
  let effLabel = '';

  if (category === 'attack') {
    const a = data.attack[z] as ZoneAttack | undefined;
    if (a && a.attempts > 0) {
      primary = `${a.kills}K`;
      secondary = `${a.attempts} att`;
      effLabel = a.hittingPct != null ? `${(a.hittingPct * 100).toFixed(1)}%` : '—';
    }
  } else if (category === 'serve') {
    const s = data.serve[z] as ZoneServe | undefined;
    if (s && s.attempts > 0) {
      primary = `${s.aces}A`;
      secondary = `${s.attempts} srv`;
      effLabel = s.efficiency != null ? `${(s.efficiency * 100).toFixed(0)}%` : '—';
    }
  } else if (category === 'pass') {
    const p = data.pass[z] as ZonePass | undefined;
    if (p && p.attempts > 0) {
      primary = `${p.attempts}`;
      secondary = `${p.pass3}+${p.pass2}+${p.pass1}+${p.pass0}`;
      effLabel = p.rating != null ? p.rating.toFixed(2) : '—';
    }
  } else {
    const d = data.defence[z] as ZoneDefence | undefined;
    if (d && d.total > 0) {
      primary = `${d.digs}D`;
      secondary = `${d.soloBlocks}B`;
      effLabel = `${d.total}`;
    }
  }

  const hasData = volume > 0;

  return (
    <div
      className="relative flex flex-col items-center justify-center h-20 border border-court-700/40 select-none"
      style={{ backgroundColor: hasData ? `${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')}` : undefined }}
    >
      {/* Zone number */}
      <span className={clsx('text-xs font-mono font-bold absolute top-1 left-2', hasData ? 'text-chalk-500' : 'text-court-700')}>
        {zone}
      </span>

      {hasData ? (
        <>
          <span className="font-mono font-bold text-chalk-100 text-sm leading-tight">{primary}</span>
          <span className="font-mono text-chalk-400 text-[10px] leading-tight">{secondary}</span>
          <span
            className="mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color, backgroundColor: `${color}22` }}
          >
            {effLabel}
          </span>
        </>
      ) : (
        <span className="text-court-700 text-xs font-mono">—</span>
      )}
    </div>
  );
}

interface Props {
  data: DetailedHeatmapData;
  defaultCategory?: Category;
  title?: string;
}

export default function CourtHeatMap({ data, defaultCategory = 'attack', title }: Props) {
  const [category, setCategory] = useState<Category>(defaultCategory);
  const cat = CATEGORIES.find((c) => c.key === category)!;

  const totalVolume = ['1','2','3','4','5','6'].reduce(
    (sum, z) => sum + zoneVolume(z, data, category), 0
  );

  return (
    <div className="card p-4 space-y-4">
      {title && <h3 className="font-semibold text-chalk-100">{title}</h3>}

      {/* Category selector */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={clsx(
              'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
              category === c.key
                ? 'text-court-950 border-transparent'
                : 'bg-court-800 text-chalk-400 border-court-700 hover:border-chalk-500'
            )}
            style={category === c.key ? { backgroundColor: c.color, borderColor: c.color } : {}}
          >
            {c.label}
          </button>
        ))}
      </div>

      {totalVolume === 0 ? (
        <div className="text-sm text-chalk-500 text-center py-8 border border-dashed border-court-700 rounded-xl">
          No zone data for {cat.label.toLowerCase()} events yet.<br />
          <span className="text-xs text-chalk-600">Select a court zone when recording events.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Court grid */}
          <div className="relative border border-court-700 rounded-xl overflow-hidden bg-court-900">
            {ZONE_LAYOUT.map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-3">
                {row.map((zone) => (
                  <ZoneCell key={zone} zone={zone} data={data} category={category} color={cat.color} />
                ))}
              </div>
            ))}
            {/* Net divider */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-spike-500/40 pointer-events-none" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none
                            text-[9px] font-bold tracking-widest text-spike-400/50 bg-court-900 px-1.5">
              NET
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-chalk-500">
            <div className="flex items-center gap-1.5 flex-1">
              <span>Low</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${cat.color}14, ${cat.color}cc)` }} />
              <span>High</span>
            </div>
            <span className="shrink-0 text-chalk-400">{totalVolume} events · {cat.description}</span>
          </div>
        </div>
      )}
    </div>
  );
}
