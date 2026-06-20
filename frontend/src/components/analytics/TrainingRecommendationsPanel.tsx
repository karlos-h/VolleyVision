import type { TrainingRecommendation } from '../../types';

interface Props {
  recommendations: TrainingRecommendation[];
}

const CATEGORY_LABELS: Record<TrainingRecommendation['category'], string> = {
  attack:             'Attack',
  serve:              'Serve',
  pass:               'Pass',
  defence:            'Defence',
  rotation:           'Rotation',
  player_development: 'Player Dev',
};

export default function TrainingRecommendationsPanel({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="card p-6 text-center text-chalk-400 text-sm">
        No training recommendations — team stats are within healthy ranges.
      </div>
    );
  }

  // Highest allocationPct in the list, used to normalise bar widths
  const maxAlloc = recommendations[0]?.allocationPct ?? 1;

  return (
    <div className="space-y-3">
      {recommendations.map((item, i) => (
        <div key={i} className="card p-4 space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-chalk-500/20 text-chalk-400">
                {CATEGORY_LABELS[item.category]}
              </span>
              <span className="text-sm font-semibold text-chalk-100">{item.focus}</span>
            </div>
            <span className="font-mono text-sm font-bold text-chalk-100 shrink-0">
              {item.allocationPct}%
            </span>
          </div>

          {/* Allocation bar */}
          <div className="h-1.5 rounded-full bg-court-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                item.category === 'player_development'
                  ? 'bg-yellow-400'
                  : item.allocationPct >= 15
                  ? 'bg-red-400'
                  : 'bg-green-400'
              }`}
              style={{ width: `${(item.allocationPct / maxAlloc) * 100}%` }}
            />
          </div>

          {/* Rationale */}
          <p className="text-xs text-chalk-400 leading-relaxed">{item.rationale}</p>
        </div>
      ))}
    </div>
  );
}
