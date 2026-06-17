import { Link, useParams } from 'react-router-dom';
import { usePlayerAnalytics, usePlayerHeatmap } from '../hooks';
import { StatsCards } from '../components/analytics/StatsOverview';
import { POSITION_LABELS } from '../types';
import PlayerRadarChart from '../components/charts/PlayerRadarChart';
import HeatMapCourt from '../components/court/HeatMapCourt';
import type { StatLine } from '../types';

export default function PlayerDashboardPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const { data, isLoading, isError } = usePlayerAnalytics(playerId!);
  const { data: heatmapData } = usePlayerHeatmap(playerId!);

  if (isLoading) return <p className="text-chalk-400">Loading analytics…</p>;
  if (isError || !data) return <p className="text-red-400">Unable to load player analytics.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/teams/${data.player.teamId}`}
          className="text-sm text-chalk-400 hover:text-chalk-100"
        >
          ← Back to Roster
        </Link>

        <h1 className="text-2xl font-bold text-chalk-100 mt-2">
          #{data.player.jerseyNumber} {data.player.firstName} {data.player.lastName}
        </h1>
        <p className="text-sm text-chalk-400 mt-1">
          {POSITION_LABELS[data.player.position]}
        </p>
      </div>

      <StatsCards stats={data.stats} />
      <PlayerRadarChart stats={data.stats} />

      {heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Player Heat Map</h2>
          <HeatMapCourt data={heatmapData} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-chalk-100 mb-3">Set Breakdown</h2>
        {data.setStats.length === 0 ? (
          <div className="card p-6 text-chalk-400 text-sm text-center">
            Record events to generate set statistics.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.setStats.map((set: StatLine & { setNumber: number }) => (
              <div key={set.setNumber} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-chalk-100">Set {set.setNumber}</h3>
                  <span className="font-mono text-xs text-chalk-400">{set.totalEvents} events</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-chalk-500">Kills</span><span className="font-mono ml-2 text-chalk-100">{set.kills}</span></div>
                  <div><span className="text-chalk-500">Aces</span><span className="font-mono ml-2 text-chalk-100">{set.aces}</span></div>
                  <div><span className="text-chalk-500">Blocks</span><span className="font-mono ml-2 text-chalk-100">{set.totalBlocks}</span></div>
                  <div><span className="text-chalk-500">Digs</span><span className="font-mono ml-2 text-chalk-100">{set.digs}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
