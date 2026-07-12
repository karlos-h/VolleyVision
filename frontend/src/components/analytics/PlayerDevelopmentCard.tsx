import type { PlayerDevelopmentReport } from '../../types';

interface Props {
  report: PlayerDevelopmentReport;
}

const TREND_LABEL: Record<PlayerDevelopmentReport['trend'], string> = {
  improving:         'Improving',
  declining:         'Declining',
  stable:            'Stable',
  insufficient_data: 'Not enough data',
};

const TREND_COLOR: Record<PlayerDevelopmentReport['trend'], string> = {
  improving:         'text-success-dark',
  declining:         'text-error-dark',
  stable:            'text-chalk-400',
  insufficient_data: 'text-chalk-500',
};

export default function PlayerDevelopmentCard({ report }: Props) {
  if (report.trend === 'insufficient_data') {
    return (
      <div className="card p-6 text-center text-chalk-400 text-sm">
        Not enough match history yet — development report requires at least 6 completed matches.
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-5">
      {/* Overall trend */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-chalk-300">Overall trend</h3>
        <span className={`text-sm font-semibold ${TREND_COLOR[report.trend]}`}>
          {TREND_LABEL[report.trend]}
        </span>
      </div>

      {/* Most improved / needs attention callouts */}
      {(report.mostImproved || report.needsAttention) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {report.mostImproved && (
            <div className="rounded-lg p-3 bg-success/10 border border-success/20">
              <p className="text-[10px] font-semibold text-success-dark mb-1">
                Most Improved
              </p>
              <p className="text-sm font-semibold text-success-dark">{report.mostImproved.category}</p>
              <p className="text-xs text-success-dark mt-0.5 font-mono">{report.mostImproved.change}</p>
            </div>
          )}
          {report.needsAttention && (
            <div className="rounded-lg p-3 bg-warning/10 border border-warning/20">
              <p className="text-[10px] font-semibold text-warning mb-1">
                Needs Attention
              </p>
              <p className="text-sm font-semibold text-warning">{report.needsAttention.category}</p>
              <p className="text-xs text-warning mt-0.5 font-mono">{report.needsAttention.change}</p>
            </div>
          )}
        </div>
      )}

      {/* Strengths / weaknesses */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-chalk-500 mb-2">
            Strengths
          </p>
          {report.strengths.length === 0 ? (
            <p className="text-xs text-chalk-500">None identified</p>
          ) : (
            <ul className="space-y-1">
              {report.strengths.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm text-success-dark">
                  <span className="text-success-dark text-xs">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold text-chalk-500 mb-2">
            Weaknesses
          </p>
          {report.weaknesses.length === 0 ? (
            <p className="text-xs text-chalk-500">None identified</p>
          ) : (
            <ul className="space-y-1">
              {report.weaknesses.map((w) => (
                <li key={w} className="flex items-center gap-2 text-sm text-error-dark">
                  <span className="text-error-dark text-xs">✗</span>
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
