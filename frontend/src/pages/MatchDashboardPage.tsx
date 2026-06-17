import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useMatchAnalytics, useMatchHeatmap } from '../hooks';
import { PlayerStatsTable, StatsCards } from '../components/analytics/StatsOverview';
import CourtVisualization from '../components/court/CourtVisualization';
import HeatMapCourt from '../components/court/HeatMapCourt';

export default function MatchDashboardPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { data, isLoading, isError } = useMatchAnalytics(matchId!);
  const { data: heatmapData } = useMatchHeatmap(matchId!);

  if (isLoading) return <p className="text-chalk-400">Loading analytics...</p>;
  if (isError || !data) return <p className="text-red-400">Unable to load match analytics.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to={`/teams/${data.match.teamId}/matches`} className="text-sm text-chalk-400 hover:text-chalk-100">
            Back to matches
          </Link>
          <h1 className="text-2xl font-bold text-chalk-100 mt-2">
            {data.match.teamName} vs {data.match.opponent}
          </h1>
          <p className="text-sm text-chalk-400 mt-1">
            {format(new Date(data.match.matchDate), 'PPP')}
            {data.match.competition && ` | ${data.match.competition}`}
          </p>
        </div>
        <Link to={`/track/${data.match.id}`} className="btn-primary text-sm">
          {data.match.status === 'COMPLETED' ? 'View Events' : 'Open Tracking'}
        </Link>
      </div>

      <StatsCards stats={data.teamStats} />

      <section>
        <h2 className="text-lg font-semibold text-chalk-100 mb-3">Set Breakdown</h2>
        {!data.setStats.length ? (
          <div className="card p-6 text-chalk-400 text-sm">Record events to generate set analytics.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.setStats.map((set) => (
              <div key={set.setNumber} className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-chalk-100">Set {set.setNumber}</h3>
                  <span className="font-mono text-xs text-chalk-400">{set.totalEvents} events</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div><p className="font-mono text-lg">{set.kills}</p><p className="text-xs text-chalk-600">Kills</p></div>
                  <div><p className="font-mono text-lg">{set.aces}</p><p className="text-xs text-chalk-600">Aces</p></div>
                  <div><p className="font-mono text-lg">{set.digs}</p><p className="text-xs text-chalk-600">Digs</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sprint 2 — Court Activity */}
      {heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Court Activity</h2>
          <CourtVisualization heatmapData={heatmapData} />
        </section>
      )}

      {/* Sprint 3 — Heat Map */}
      {heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Heat Map</h2>
          <HeatMapCourt data={heatmapData} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-chalk-100 mb-3">Player Statistics</h2>
        <PlayerStatsTable rows={data.playerStats} />
      </section>
    </div>
  );
}
