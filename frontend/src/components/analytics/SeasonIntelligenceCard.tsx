import type { SeasonIntelligenceReport } from '../../types';

interface Props {
  report: SeasonIntelligenceReport;
}

const TRAJECTORY_LABEL: Record<SeasonIntelligenceReport['trajectory'], string> = {
  improving:        'Improving',
  declining:        'Declining',
  mixed:            'Mixed',
  insufficient_data:'Insufficient data',
};

const TRAJECTORY_COLOR: Record<SeasonIntelligenceReport['trajectory'], string> = {
  improving:        'text-green-400',
  declining:        'text-red-400',
  mixed:            'text-yellow-400',
  insufficient_data:'text-chalk-500',
};

const AVG_LABELS: { key: keyof SeasonIntelligenceReport['seasonAverages']; label: string }[] = [
  { key: 'kills',            label: 'Avg Kills'    },
  { key: 'aces',             label: 'Avg Aces'     },
  { key: 'blocks',           label: 'Avg Blocks'   },
  { key: 'digs',             label: 'Avg Digs'     },
  { key: 'hittingPercentage',label: 'Avg Hit %'    },
];

export default function SeasonIntelligenceCard({ report }: Props) {
  const { seasonAverages, insights, trajectory } = report;

  return (
    <div className="card p-5 space-y-5">
      {/* Season averages row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {AVG_LABELS.map(({ key, label }) => {
          const val = seasonAverages[key];
          const display = val === null
            ? '—'
            : key === 'hittingPercentage'
              ? (val as number).toFixed(3)
              : (val as number).toFixed(1);
          return (
            <div key={key} className="text-center">
              <p className="text-xs uppercase tracking-wider text-chalk-500 mb-1">{label}</p>
              <p className="font-mono text-lg font-bold text-chalk-100">{display}</p>
            </div>
          );
        })}
      </div>

      {/* Trajectory */}
      <div className="flex items-center justify-between border-t border-court-800 pt-4">
        <span className="text-xs uppercase tracking-wider text-chalk-500">Season Trajectory</span>
        <span className={`text-sm font-semibold ${TRAJECTORY_COLOR[trajectory]}`}>
          {TRAJECTORY_LABEL[trajectory]}
        </span>
      </div>

      {/* Streak insights */}
      {trajectory === 'insufficient_data' ? (
        <p className="text-sm text-chalk-500 text-center">
          Not enough completed matches yet — season intelligence requires at least 5 matches.
        </p>
      ) : insights.length === 0 ? (
        <p className="text-sm text-chalk-500 text-center">
          No significant streaks detected across the last {'{'}5+{'}'} matches.
        </p>
      ) : (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 text-sm ${
                insight.direction === 'positive'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                  : 'bg-red-500/10 border border-red-500/20 text-red-300'
              }`}
            >
              {insight.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
