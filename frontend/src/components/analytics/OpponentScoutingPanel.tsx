import { useOpponentScoutingReport } from '../../hooks';
import type { OpponentScoutingReport } from '../../types';
import clsx from 'clsx';

const ERROR_LABELS: Record<string, string> = {
  ATTACK_ERROR: 'Attack Error',
  SERVICE_ERROR: 'Service Error',
  BLOCK_ERROR: 'Block Error',
  DIG_ERROR: 'Dig Error',
  SETTING_ERROR: 'Setting Error',
};

function ZoneGrid({ label, getValue, format }: {
  label: string;
  getValue: (z: string) => number;
  format: (n: number) => string;
}) {
  const values = ['1', '2', '3', '4', '5', '6'].map((z) => getValue(z));
  const max = Math.max(...values, 1);
  return (
    <div>
      <div className="text-xs text-chalk-500 mb-2">{label}</div>
      <div className="grid grid-cols-6 gap-1">
        {['1', '2', '3', '4', '5', '6'].map((z, i) => {
          const v = values[i];
          const intensity = v / max;
          return (
            <div
              key={z}
              className="flex flex-col items-center justify-center rounded-lg py-2 border border-court-700"
              style={{ backgroundColor: `rgba(239, 68, 68, ${intensity * 0.6 + 0.05})` }}
            >
              <span className="text-[10px] text-chalk-500">Z{z}</span>
              <span className="font-mono text-xs font-bold text-chalk-100">{format(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportView({ report }: { report: OpponentScoutingReport }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="badge bg-court-800 border border-court-700 text-chalk-400">
          {report.totalEvents} opponent events recorded
        </span>
      </div>

      {/* Zone breakdown — attacks and serves */}
      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-chalk-200">Zone breakdown</h3>
        <ZoneGrid
          label="Opponent Kills by Zone"
          getValue={(z) => report.zoneBreakdown.attack[z]?.kills ?? 0}
          format={(n) => String(n)}
        />
        <ZoneGrid
          label="Opponent Aces by Zone"
          getValue={(z) => report.zoneBreakdown.serve[z]?.aces ?? 0}
          format={(n) => String(n)}
        />
      </div>

      {/* Dominant error type */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-chalk-200 mb-3">Opponent Errors</h3>
        {report.dominantErrorType == null ? (
          <p className="text-sm text-chalk-500 italic">No opponent errors recorded.</p>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-spike-400 font-mono text-2xl font-bold">
              {report.dominantErrorCount}
            </span>
            <div>
              <div className="text-sm text-chalk-100 font-medium">
                {ERROR_LABELS[report.dominantErrorType] ?? report.dominantErrorType}
              </div>
              <div className="text-xs text-chalk-500">Most common opponent error</div>
            </div>
          </div>
        )}
      </div>

      {/* Jersey tally */}
      {report.jerseyTallies && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-chalk-200 mb-3">By Jersey Number</h3>
          <div className="divide-y divide-court-800">
            {report.jerseyTallies.map((t) => (
              <div key={t.jerseyNumber} className="flex items-center gap-4 py-2.5">
                <span className="font-mono font-bold text-spike-400 w-8 shrink-0">#{t.jerseyNumber}</span>
                <div className="flex gap-4 text-xs">
                  <span className={clsx(t.kills > 0 ? 'text-success-dark' : 'text-chalk-600')}>
                    {t.kills} K
                  </span>
                  <span className={clsx(t.aces > 0 ? 'text-success-dark' : 'text-chalk-600')}>
                    {t.aces} A
                  </span>
                  <span className={clsx(t.errors > 0 ? 'text-error-dark' : 'text-chalk-600')}>
                    {t.errors} Err
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  matchId: string;
}

export default function OpponentScoutingPanel({ matchId }: Props) {
  const { data, isLoading } = useOpponentScoutingReport(matchId);

  if (isLoading) {
    return <div className="card p-6 text-chalk-400 text-sm animate-pulse">Loading opponent data…</div>;
  }

  if (!data) {
    return (
      <div className="card p-6 text-center text-chalk-500 text-sm">
        No opponent data available.
      </div>
    );
  }

  if (data.insufficientData) {
    return (
      <div className="card p-6 text-center space-y-1">
        <p className="text-chalk-300 text-sm font-medium">Insufficient opponent data</p>
        <p className="text-chalk-500 text-xs">
          {data.totalEvents} event{data.totalEvents !== 1 ? 's' : ''} recorded — need at least 10 for a report.
          Use the "Opponent" toggle in tracking to record their actions.
        </p>
      </div>
    );
  }

  return <ReportView report={data} />;
}
