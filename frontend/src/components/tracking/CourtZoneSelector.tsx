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
        <span className="text-xs font-semibold text-grey-600">
          Court Zone <span className="normal-case font-normal text-grey-400">(optional)</span>
        </span>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-grey-600 hover:text-navy-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative border border-grey-200 rounded-xl overflow-hidden bg-grey-50 select-none">
        {/* NET divider — a gold line spanning the court centre */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-gold-500/60 z-10 pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                        text-[9px] font-bold tracking-widest text-navy-700 bg-grey-50 px-1.5 pointer-events-none">
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
                  'h-12 flex items-center justify-center border border-grey-200',
                  'text-lg font-mono font-bold transition-all active:scale-95',
                  value === zone
                    ? 'bg-gold-500 text-navy-900 shadow-inner'
                    : 'bg-white text-grey-900 hover:bg-grey-200'
                )}
              >
                {zone}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-grey-400 px-0.5">
        {value !== null
          ? `Zone ${value} selected — tap again to deselect`
          : 'Tap a zone to record attack/serve location'}
      </p>
    </div>
  );
}
