import clsx from 'clsx';

// Standard volleyball court zones (viewed from home team end):
//   4 | 3 | 2   ← front row
//   5 | 6 | 1   ← back row
// Zone 1 = back-right serve position; zones continue counter-clockwise.

const ZONE_LAYOUT = [
  [4, 3, 2],
  [5, 6, 1],
] as const;

interface Props {
  value: number | null;
  onChange: (zone: number | null) => void;
}

export default function CourtZoneSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-semibold text-navy-300">
          Court Zone <span className="normal-case font-normal text-navy-300/70">(optional)</span>
        </span>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-navy-300 hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative border border-navy-600 rounded-xl overflow-hidden bg-navy-800 select-none">
        {/* NET divider */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-gold-500/50 z-10 pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                        text-[9px] font-bold tracking-widest text-gold-500/60 bg-navy-800 px-1.5 pointer-events-none">
          NET
        </div>

        {ZONE_LAYOUT.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-3">
            {row.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => onChange(value === zone ? null : zone)}
                className={clsx(
                  'h-12 flex items-center justify-center border border-navy-600/40',
                  'text-lg font-mono font-bold transition-all active:scale-95',
                  value === zone
                    ? 'bg-gold-500 text-navy-900 shadow-inner'
                    : 'bg-navy-700 text-navy-100 hover:bg-navy-500 hover:text-white'
                )}
              >
                {zone}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-navy-300/70 px-0.5">
        {value !== null
          ? `Zone ${value} selected — tap again to deselect`
          : 'Tap a zone to record attack/serve location'}
      </p>
    </div>
  );
}
