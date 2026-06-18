import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useMatchAnalytics, useMatchHeatmap, useMatchMomentum } from '../hooks';
import { PlayerStatsTable, StatsCards } from '../components/analytics/StatsOverview';
import CourtVisualization from '../components/court/CourtVisualization';
import HeatMapCourt from '../components/court/HeatMapCourt';
import MomentumChart from '../components/charts/MomentumChart';

export default function MatchDashboardPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { data, isLoading, isError } = useMatchAnalytics(matchId!);
  const { data: heatmapData } = useMatchHeatmap(matchId!);
  const { data: momentumData } = useMatchMomentum(matchId!);

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

      {/* Phase 4 — Final Score Summary */}
      <div className="card p-4 space-y-3">
        {/* Match winner */}
        {data.match.status === 'COMPLETED' && (
          <div className="text-center py-2 rounded-lg bg-spike-500/10 border border-spike-500/30 text-spike-400 font-semibold text-sm">
            {data.match.homeSetsWon >= data.match.awaySetsWon
              ? `${data.match.teamName} won the match`
              : `${data.match.opponent} won the match`}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-right">
            <div className="text-sm text-chalk-400 mb-1">{data.match.teamName}</div>
            <div className="font-mono text-3xl font-bold text-chalk-100">{data.match.homeScore}</div>
          </div>
          <div className="text-center shrink-0">
            <div className="flex items-center gap-2 justify-center mb-1">
              <span className="font-mono text-2xl font-bold text-spike-400">{data.match.homeSetsWon}</span>
              <span className="text-chalk-500 text-sm">–</span>
              <span className="font-mono text-2xl font-bold text-chalk-400">{data.match.awaySetsWon}</span>
            </div>
            <div className="text-xs text-chalk-500 uppercase tracking-wider">Sets Won</div>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm text-chalk-400 mb-1">{data.match.opponent}</div>
            <div className="font-mono text-3xl font-bold text-chalk-400">{data.match.awayScore}</div>
          </div>
        </div>

        {/* Per-set results */}
        {Array.isArray(data.match.setScores) && (data.match.setScores as {set:number;home:number;away:number}[]).length > 0 && (
          <div className="border-t border-court-800 pt-3">
            <div className="text-xs text-chalk-500 uppercase tracking-wider mb-2 text-center">Set Results</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {(data.match.setScores as {set:number;home:number;away:number}[]).map((s) => {
                const homeWon = s.home > s.away;
                return (
                  <div key={s.set} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-chalk-500">S{s.set}</span>
                    <span className={`font-mono text-sm font-bold px-3 py-1 rounded border ${homeWon ? 'text-spike-400 border-spike-500/30 bg-spike-500/10' : 'text-chalk-400 border-court-700 bg-court-800'}`}>
                      {s.home}–{s.away}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

      {/* Sprint 3 — Momentum */}
      <section>
        <h2 className="text-lg font-semibold text-chalk-100 mb-3">Match Momentum</h2>
        {momentumData ? (
          <MomentumChart
            data={momentumData}
            teamName={data.match.teamName}
            opponentName={data.match.opponent}
          />
        ) : (
          <div className="card p-6 text-center text-chalk-400 text-sm">Record scoring events to generate momentum analytics.</div>
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
