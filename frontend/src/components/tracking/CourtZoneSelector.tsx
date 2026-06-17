import clsx from 'clsx';

// Standard volleyball court zones:
//  4 | 3 | 2
//  5 | 6 | 1
// Zone 1 = back-right (serve position), zones go counter-clockwise.

const ZONE_LAYOUT = [
  [4, 3, 2],
  [5, 6, 1],
] as const;

interface Props {
  value: number | null;
  onChange: (zone: number | null) => void;
}

export default function CourtZoneSelector({ value, onChange }: Props) {
  function handleClick(zone: number) {
    // Tap the same zone again to deselect
    onChange(value === zone ? null : zone);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 mb-0.5">
        <span className="text-xs font-semibold text-chalk-500 uppercase tracking-widest">
          Court Zone
        </span>
        {value !== null && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-chalk-500 hover:text-chalk-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Net line */}
      <div className="relative border border-court-700 rounded-xl overflow-hidden bg-court-900">
        {/* Net indicator */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-spike-500/60 z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                        text-[9px] font-bold text-spike-400/70 bg-court-900 px-1 select-none">
          NET
        </div>

        {ZONE_LAYOUT.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-3">
            {row.map((zone) => (
              <button
                key={zone}
                onClick={() => handleClick(zone)}
                className={clsx(
                  'relative h-14 flex items-center justify-center',
                  'text-lg font-mono font-bold transition-all',
                  'border border-court-700/50',
                  'active:scale-95',
                  value === zone
                    ? 'bg-spike-500 text-court-950 shadow-inner'
                    : 'bg-court-800 text-chalk-400 hover:bg-court-700 hover:text-chalk-200'
                )}
              >
                {zone}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-chalk-600 px-1">
        {value !== null ? `Zone ${value} selected` : 'Optional — tap a zone to record location'}
      </p>
    </div>
  );
}
