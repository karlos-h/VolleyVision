import type { AdvancedMetrics, HeatmapData } from '../../types';

interface Props {
  data: AdvancedMetrics;
  heatmapData?: HeatmapData;
}

// Horizontal progress bar used for percentage metrics
function StatBar({
  label,
  value,
  max = 100,
  color = 'bg-spike-500',
  suffix = '%',
  sublabel,
}: {
  label: string;
  value: number | null;
  max?: number;
  color?: string;
  suffix?: string;
  sublabel?: string;
}) {
  const pct = value != null ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-chalk-400">{label}</span>
        <span className="text-xs font-mono font-semibold text-chalk-200">
          {value != null ? `${value}${suffix}` : '—'}
        </span>
      </div>
      <div className="h-2 bg-court-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sublabel && <p className="text-[10px] text-chalk-600 mt-0.5">{sublabel}</p>}
    </div>
  );
}

// Small stat card used for counts
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xs text-chalk-500 mb-1">{label}</p>
      <p className="font-mono text-2xl font-bold text-chalk-100">{value}</p>
      {sub && <p className="text-xs text-chalk-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdvancedMetricsPanel({ data, heatmapData }: Props) {
  // Attack zone distribution from heatmap
  const attackZones = heatmapData?.attack;
  const totalAttacksByZone = attackZones
    ? Object.values(attackZones).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Top row — key percentage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Side-Out %"
          value={data.sideOut.efficiencyPct != null ? `${data.sideOut.efficiencyPct}%` : '—'}
          sub={`${data.sideOut.qualityPasses} / ${data.sideOut.attempts} passes`}
        />
        <StatCard
          label="Ace Rate"
          value={data.serve.aceRate != null ? `${data.serve.aceRate}%` : '—'}
          sub={`${data.serve.aces} aces`}
        />
        <StatCard
          label="Kill Rate"
          value={data.attack.killRate != null ? `${data.attack.killRate}%` : '—'}
          sub={`${data.attack.kills} / ${data.attack.attempts}`}
        />
        <StatCard
          label="Blocks / Set"
          value={data.blocking.blocksPerSet != null ? data.blocking.blocksPerSet : '—'}
          sub={`${data.blocking.totalBlocks} total`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Serve Efficiency */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-chalk-300">Serve Efficiency</h3>
          <StatBar
            label="Positive Serve Rate"
            value={data.serve.positiveRate}
            color="bg-spike-500"
            sublabel={`${data.serve.attempts} total serves`}
          />
          <StatBar
            label="Ace Rate"
            value={data.serve.aceRate}
            color="bg-success"
          />
          <StatBar
            label="Service Error Rate"
            value={data.serve.errorRate}
            color="bg-error"
            sublabel={`${data.serve.errors} errors`}
          />
        </div>

        {/* Side-Out Efficiency */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-chalk-300">Serve Receive Quality</h3>
          <StatBar
            label="Quality Pass Rate (2–3)"
            value={data.sideOut.efficiencyPct}
            color="bg-spike-500"
            sublabel={`${data.sideOut.qualityPasses} of ${data.sideOut.attempts} passes`}
          />
          <StatBar
            label="Perfect Pass Rate (3)"
            value={data.sideOut.perfectPassRate}
            color="bg-success"
            sublabel={`${data.sideOut.pass3} perfect passes`}
          />
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-court-800">
            {[
              { label: 'Pass 3', count: data.sideOut.pass3, color: 'text-success' },
              { label: 'Pass 2', count: data.sideOut.pass2, color: 'text-navy-700' },
              { label: 'Pass 1', count: data.sideOut.pass1, color: 'text-chalk-400' },
              { label: 'Pass 0', count: data.sideOut.pass0, color: 'text-error' },
            ].map(({ label, count, color }) => (
              <div key={label} className="text-center">
                <p className={`font-mono text-lg font-bold ${color}`}>{count}</p>
                <p className="text-[10px] text-chalk-600">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Attack Metrics */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-chalk-300">Attack Efficiency</h3>
          <StatBar
            label="Kill Rate"
            value={data.attack.killRate}
            color="bg-spike-500"
            sublabel={`${data.attack.kills} kills from ${data.attack.attempts} attempts`}
          />
          <StatBar
            label="Error Rate"
            value={
              data.attack.attempts > 0
                ? Math.round((data.attack.errors / data.attack.attempts) * 1000) / 10
                : null
            }
            color="bg-error"
            sublabel={`${data.attack.errors} errors`}
          />
          <div className="flex items-center justify-between pt-1 border-t border-court-800">
            <span className="text-xs text-chalk-500">Hitting Percentage</span>
            <span className={`font-mono text-sm font-bold ${
              data.attack.hittingPct != null && data.attack.hittingPct >= 0.25
                ? 'text-success'
                : data.attack.hittingPct != null && data.attack.hittingPct >= 0
                ? 'text-navy-700'
                : 'text-error'
            }`}>
              {data.attack.hittingPct != null
                ? (data.attack.hittingPct >= 0 ? '+' : '') + (data.attack.hittingPct * 100).toFixed(1) + '%'
                : '—'}
            </span>
          </div>
        </div>

        {/* Blocking Efficiency */}
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-chalk-300">Blocking Efficiency</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-mono text-2xl font-bold text-chalk-100">{data.blocking.soloBlocks}</p>
              <p className="text-xs text-chalk-500 mt-0.5">Solo Blocks</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-chalk-100">{data.blocking.blockAssists}</p>
              <p className="text-xs text-chalk-500 mt-0.5">Block Assists</p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-navy-700">{data.blocking.totalBlocks}</p>
              <p className="text-xs text-chalk-500 mt-0.5">Total</p>
            </div>
          </div>
          <StatBar
            label={`Blocks per Set (${data.setsPlayed} sets)`}
            value={data.blocking.blocksPerSet}
            max={5}
            color="bg-spike-500"
            suffix=""
          />
        </div>
      </div>

      {/* Attack Zone Distribution */}
      {attackZones && totalAttacksByZone > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-chalk-300 mb-4">Attack Distribution by Zone</h3>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((zone) => {
              const count = attackZones[String(zone)] ?? 0;
              const pct = totalAttacksByZone > 0 ? Math.round((count / totalAttacksByZone) * 100) : 0;
              const isTop = count === Math.max(...Object.values(attackZones));
              return (
                <div key={zone} className="flex flex-col items-center gap-1">
                  <div className="text-xs font-mono font-bold text-chalk-300">{pct}%</div>
                  <div className="w-full bg-court-800 rounded-full overflow-hidden h-16 flex flex-col justify-end">
                    <div
                      className={`w-full rounded-full transition-all ${isTop ? 'bg-spike-500' : 'bg-court-600'}`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className={`text-xs font-semibold ${isTop ? 'text-navy-700' : 'text-chalk-500'}`}>
                    Z{zone}
                  </div>
                  <div className="text-[10px] text-chalk-600 font-mono">{count}</div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-chalk-600 mt-3 text-center">
            {totalAttacksByZone} total attacks with zone data
          </p>
        </div>
      )}
    </div>
  );
}
