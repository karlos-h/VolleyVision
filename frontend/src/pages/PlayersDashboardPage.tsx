import { Link, useParams } from 'react-router-dom';
import { usePlayerAnalytics, usePlayerHeatmap, usePlayerDevelopmentReport } from '../hooks';
import { StatsCards } from '../components/analytics/StatsOverview';
import { POSITION_LABELS } from '../types';
import PlayerRadarChart from '../components/charts/PlayerRadarChart';
import HeatMapCourt from '../components/court/HeatMapCourt';
import PlayerDevelopmentCard from '../components/analytics/PlayerDevelopmentCard';
import { features } from '../config/features';
import type { StatLine } from '../types';

export default function PlayerDashboardPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const { data, isLoading, isError } = usePlayerAnalytics(playerId!);
  const { data: heatmapData } = usePlayerHeatmap(playerId!);
  const { data: developmentData } = usePlayerDevelopmentReport(playerId!);

  if (isLoading) return <p className="text-navy-300">Loading analytics…</p>;
  if (isError || !data) return <p className="text-error">Couldn't load player analytics.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/teams/${data.player.teamId}`}
          className="text-sm text-navy-300 hover:text-navy-700"
        >
          ← Back to Roster
        </Link>

        <h1 className="text-2xl font-bold text-grey-900 mt-2">
          #{data.player.jerseyNumber} {data.player.firstName} {data.player.lastName}
        </h1>
        <p className="text-sm text-navy-300 mt-1">
          {POSITION_LABELS[data.player.position]}
        </p>
      </div>

      <StatsCards stats={data.stats} />
      <PlayerRadarChart stats={data.stats} />

      {/* Phase 6 Sprint 2 — Player Development Intelligence */}
      {features.recommendations && developmentData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Development Report</h2>
          <PlayerDevelopmentCard report={developmentData} />
        </section>
      )}

      {features.heatMaps && heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Player Heat Map</h2>
          <HeatMapCourt data={heatmapData} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-grey-900 mb-3">Set Breakdown</h2>
        {data.setStats.length === 0 ? (
          <div className="card p-6 text-navy-300 text-sm text-center">
            Record events to generate set statistics.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.setStats.map((set: StatLine & { setNumber: number }) => (
              <div key={set.setNumber} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-grey-900">Set {set.setNumber}</h3>
                  <span className="tabular-nums text-xs text-navy-300">{set.totalEvents} events</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-navy-300">Kills</span><span className="tabular-nums ml-2 text-grey-900">{set.kills}</span></div>
                  <div><span className="text-navy-300">Aces</span><span className="tabular-nums ml-2 text-grey-900">{set.aces}</span></div>
                  <div><span className="text-navy-300">Blocks</span><span className="tabular-nums ml-2 text-grey-900">{set.totalBlocks}</span></div>
                  <div><span className="text-navy-300">Digs</span><span className="tabular-nums ml-2 text-grey-900">{set.digs}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
