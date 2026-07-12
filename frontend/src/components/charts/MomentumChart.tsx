import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { MomentumData } from '../../types';
import { CHART_SERIES, CHART_GRID, CHART_TICK, CHART_REFERENCE } from '../../lib/chartColors';

interface Props {
  data: MomentumData;
  teamName: string;
  opponentName: string;
}

// Custom tooltip showing score at each point
function MomentumTooltip({ active, payload, teamName, opponentName }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-court-900 border border-court-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-chalk-400 mb-1">Point {d.pointNumber} · Set {d.setNumber}</div>
      <div className="font-semibold text-chalk-100 mb-1">
        {d.scorer === 'home' ? teamName : opponentName} scored
      </div>
      <div className="font-mono text-chalk-200">
        {teamName} {d.homeScore} – {d.awayScore} {opponentName}
      </div>
      {d.runLength >= 3 && (
        <div className="text-spike-400 mt-1">
          {d.runLength}-point run
        </div>
      )}
    </div>
  );
}

export default function MomentumChart({ data, teamName, opponentName }: Props) {
  const { timeline, stats, significantRuns } = data;

  if (!timeline.length) {
    return (
      <div className="card p-6 text-center text-chalk-400 text-sm">
        Record scoring events to generate momentum analytics.
      </div>
    );
  }

  // Downsample for large matches — show every Nth point if over 200 points
  const sample = timeline.length > 200
    ? timeline.filter((_, i) => i % Math.ceil(timeline.length / 200) === 0)
    : timeline;

  const maxLead = Math.max(stats.largestHomeLead, stats.largestAwayLead, 1);
  const yDomain = [-maxLead - 2, maxLead + 2];

  return (
    <div className="space-y-4">
      {/* Stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-chalk-500 mb-1">Longest run</p>
          <p className="font-mono text-2xl font-bold text-chalk-100">{stats.longestRun}</p>
          <p className="text-xs text-chalk-500 mt-0.5">
            {stats.longestHomeRun >= stats.longestAwayRun ? teamName : opponentName}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-chalk-500 mb-1">Lead changes</p>
          <p className="font-mono text-2xl font-bold text-chalk-100">{stats.leadChanges}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-chalk-500 mb-1">Largest lead</p>
          <p className="font-mono text-2xl font-bold text-spike-400">{stats.largestHomeLead}</p>
          <p className="text-xs text-chalk-500 mt-0.5">{teamName}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-chalk-500 mb-1">Largest lead</p>
          <p className="font-mono text-2xl font-bold text-chalk-400">{stats.largestAwayLead}</p>
          <p className="text-xs text-chalk-500 mt-0.5">{opponentName}</p>
        </div>
      </div>

      {/* Score differential chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-chalk-300">Score differential</h3>
          <div className="flex items-center gap-4 text-xs text-chalk-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded bg-spike-500 inline-block" /> {teamName}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded bg-navy-300 inline-block" /> {opponentName}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={sample} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_SERIES[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_SERIES[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="awayGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor={CHART_SERIES[1]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_SERIES[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="pointNumber"
              tick={{ fill: CHART_TICK, fontSize: 10 }}
              tickLine={false}
              label={{ value: 'Points played', position: 'insideBottom', offset: -2, fill: CHART_TICK, fontSize: 10 }}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: CHART_TICK, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<MomentumTooltip teamName={teamName} opponentName={opponentName} />} />
            <ReferenceLine y={0} stroke={CHART_REFERENCE} strokeDasharray="4 2" />
            {/* Positive area = home leading */}
            <Area
              type="monotone"
              dataKey="lead"
              stroke={CHART_SERIES[0]}
              strokeWidth={1.5}
              fill="url(#homeGrad)"
              dot={false}
              activeDot={{ r: 3, fill: CHART_SERIES[0] }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-between text-xs text-chalk-600 mt-1 px-1">
          <span>↑ {teamName} leading</span>
          <span>↓ {opponentName} leading</span>
        </div>
      </div>

      {/* Significant runs */}
      {significantRuns.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-chalk-300 mb-3">Scoring Runs (3+)</h3>
          <div className="flex flex-wrap gap-2">
            {significantRuns.map((run, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                  run.team === 'home'
                    ? 'bg-spike-500/10 border-spike-500/30 text-spike-400'
                    : 'bg-court-800 border-court-700 text-chalk-400'
                }`}
              >
                <span className="font-mono font-bold">{run.length}-0</span>
                <span>{run.team === 'home' ? teamName : opponentName}</span>
                <span className="text-[10px] opacity-60">from pt {run.startPoint}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
