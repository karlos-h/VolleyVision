import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { RotationData } from '../../types';

interface Props {
  data: RotationData;
}

function RotationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-court-900 border border-court-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-chalk-100 mb-1">Rotation {d.rotation}</div>
      <div className="space-y-0.5 text-chalk-300">
        <div>Points Won: <span className="text-emerald-400 font-mono">{d.won}</span></div>
        <div>Points Lost: <span className="text-red-400 font-mono">{d.lost}</span></div>
        <div>Net: <span className={`font-mono font-bold ${d.net >= 0 ? 'text-spike-400' : 'text-red-400'}`}>{d.net > 0 ? '+' : ''}{d.net}</span></div>
        {d.efficiency != null && (
          <div>Efficiency: <span className="font-mono text-chalk-100">{d.efficiency}%</span></div>
        )}
      </div>
    </div>
  );
}

export default function RotationAnalytics({ data }: Props) {
  const { rotations, insights } = data;
  const hasData = rotations.some((r) => r.total > 0);

  if (!hasData) {
    return (
      <div className="card p-6 text-center text-chalk-400 text-sm">
        Tag events with a rotation number during tracking to generate rotation analytics.
      </div>
    );
  }

  const maxAbs = Math.max(...rotations.map((r) => Math.abs(r.net)), 1);

  return (
    <div className="space-y-4">
      {/* Insight cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {insights.best && (
          <div className="card p-3 border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs text-chalk-500 uppercase tracking-wider mb-1">Best Rotation</p>
            <p className="font-mono text-2xl font-bold text-emerald-400">R{insights.best.rotation}</p>
            <p className="text-xs text-chalk-500 mt-0.5">Net +{insights.best.net}</p>
          </div>
        )}
        {insights.worst && (
          <div className="card p-3 border-red-500/20 bg-red-500/5">
            <p className="text-xs text-chalk-500 uppercase tracking-wider mb-1">Worst Rotation</p>
            <p className="font-mono text-2xl font-bold text-red-400">R{insights.worst.rotation}</p>
            <p className="text-xs text-chalk-500 mt-0.5">Net {insights.worst.net}</p>
          </div>
        )}
        {insights.highestSideOut && (
          <div className="card p-3">
            <p className="text-xs text-chalk-500 uppercase tracking-wider mb-1">Best Side-Out</p>
            <p className="font-mono text-2xl font-bold text-spike-400">R{insights.highestSideOut.rotation}</p>
            <p className="text-xs text-chalk-500 mt-0.5">{insights.highestSideOut.efficiency}%</p>
          </div>
        )}
        {insights.lowestSideOut && (
          <div className="card p-3">
            <p className="text-xs text-chalk-500 uppercase tracking-wider mb-1">Worst Side-Out</p>
            <p className="font-mono text-2xl font-bold text-chalk-400">R{insights.lowestSideOut.rotation}</p>
            <p className="text-xs text-chalk-500 mt-0.5">{insights.lowestSideOut.efficiency}%</p>
          </div>
        )}
      </div>

      {/* Net efficiency chart */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-chalk-300 mb-4">Net Points Per Rotation</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rotations} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#162d58" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="rotation"
              tickFormatter={(v) => `R${v}`}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              domain={[-maxAbs - 1, maxAbs + 1]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<RotationTooltip />} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
              {rotations.map((r) => (
                <Cell
                  key={r.rotation}
                  fill={r.net > 0 ? '#f59e0b' : r.net < 0 ? '#ef4444' : '#334155'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rotation table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-court-800 text-xs text-chalk-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Rotation</th>
              <th className="text-right px-4 py-3">Won</th>
              <th className="text-right px-4 py-3">Lost</th>
              <th className="text-right px-4 py-3">Net</th>
              <th className="text-right px-4 py-3">Efficiency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-court-800">
            {rotations.map((r) => (
              <tr key={r.rotation} className={r.total === 0 ? 'opacity-30' : ''}>
                <td className="px-4 py-2.5 font-semibold text-chalk-200">Rotation {r.rotation}</td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{r.won}</td>
                <td className="px-4 py-2.5 text-right font-mono text-red-400">{r.lost}</td>
                <td className={`px-4 py-2.5 text-right font-mono font-bold ${r.net > 0 ? 'text-spike-400' : r.net < 0 ? 'text-red-400' : 'text-chalk-500'}`}>
                  {r.net > 0 ? '+' : ''}{r.net}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-chalk-300">
                  {r.efficiency != null ? `${r.efficiency}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
