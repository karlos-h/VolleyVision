import { useParams } from 'react-router-dom';
import { useMatchAnalytics, useMatchHeatmap, useMatchMomentum, useMatchRotations, useMatchAdvanced, useMatchReport, useMatchZoneDetail, useMatchReportNarrative, useHasPermission } from '../hooks';
import MatchPageHeader from '../components/ui/MatchPageHeader';
import { PlayerStatsTable, StatsCards } from '../components/analytics/StatsOverview';
import CourtVisualization from '../components/court/CourtVisualization';
import HeatMapCourt from '../components/court/HeatMapCourt';
import CourtHeatMap from '../components/analytics/CourtHeatMap';
import MomentumChart from '../components/charts/MomentumChart';
import RotationAnalytics from '../components/analytics/RotationAnalytics';
import AdvancedMetricsPanel from '../components/analytics/AdvancedMetricsPanel';
import MatchReportCard from '../components/analytics/MatchReportCard';
import VideoPanel from '../components/analytics/VideoPanel';
import OpponentScoutingPanel from '../components/analytics/OpponentScoutingPanel';
import { features } from '../config/features';

export default function MatchDashboardPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { data, isLoading, isError } = useMatchAnalytics(matchId!);
  const { data: heatmapData } = useMatchHeatmap(matchId!);
  const { data: momentumData } = useMatchMomentum(matchId!);
  const { data: rotationData } = useMatchRotations(matchId!);
  const { data: advancedData } = useMatchAdvanced(matchId!);
  const { data: reportData } = useMatchReport(matchId!);
  const { data: zoneDetail } = useMatchZoneDetail(matchId!);
  const { data: narrativeData, isLoading: narrativeLoading, isError: narrativeError } = useMatchReportNarrative(matchId!);
  // teamId is only known once the match loads; the hook stays unconditional and
  // re-runs when it resolves. Track is offered only to those who can track a
  // live match (players never can — Iteration 3 Task 6).
  const canTrack = useHasPermission(data?.match.teamId ?? '', 'TRACK_MATCH');

  if (isLoading) return <p className="text-grey-600">Loading analytics...</p>;
  if (isError || !data) return <p className="text-error">Couldn't load match analytics.</p>;

  return (
    <div className="space-y-6">
      <MatchPageHeader
        matchId={data.match.id}
        teamId={data.match.teamId}
        teamName={data.match.teamName}
        opponent={data.match.opponent}
        matchDate={data.match.matchDate}
        competition={data.match.competition}
        venue={data.match.venue}
        status={data.match.status}
        canTrack={canTrack}
      />

      {/* Phase 4 — Final Score Summary */}
      <div className="card p-4 space-y-3">
        {/* Match winner */}
        {data.match.status === 'COMPLETED' && (
          <div className="text-center py-2 rounded-lg bg-gold-500/10 border border-gold-500/30 text-navy-700 font-semibold text-sm">
            {data.match.homeSetsWon >= data.match.awaySetsWon
              ? `${data.match.teamName} won the match`
              : `${data.match.opponent} won the match`}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-right">
            <div className="text-sm text-navy-300 mb-1">{data.match.teamName}</div>
            <div className="tabular-nums text-3xl font-bold text-grey-900">{data.match.homeScore}</div>
          </div>
          <div className="text-center shrink-0">
            <div className="flex items-center gap-2 justify-center mb-1">
              <span className="tabular-nums text-2xl font-bold text-navy-700">{data.match.homeSetsWon}</span>
              <span className="text-navy-300 text-sm">–</span>
              <span className="tabular-nums text-2xl font-bold text-navy-300">{data.match.awaySetsWon}</span>
            </div>
            <div className="text-xs text-navy-300">Sets won</div>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm text-navy-300 mb-1">{data.match.opponent}</div>
            <div className="tabular-nums text-3xl font-bold text-navy-300">{data.match.awayScore}</div>
          </div>
        </div>

        {/* Per-set results */}
        {Array.isArray(data.match.setScores) && (data.match.setScores as {set:number;home:number;away:number}[]).length > 0 && (
          <div className="border-t border-navy-700 pt-3">
            <div className="text-xs text-navy-300 mb-2 text-center">Set results</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {(data.match.setScores as {set:number;home:number;away:number}[]).map((s) => {
                const homeWon = s.home > s.away;
                return (
                  <div key={s.set} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-navy-300">S{s.set}</span>
                    <span className={`tabular-nums text-sm font-bold px-3 py-1 rounded border ${homeWon ? 'text-navy-700 border-gold-500/30 bg-gold-500/10' : 'text-navy-300 border-navy-600 bg-navy-700'}`}>
                      {s.home}–{s.away}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sprint 6 — Automated Match Report */}
      {reportData && <MatchReportCard report={reportData} />}

      {/* Phase 6 Sprint 0 — AI Match Summary */}
      {features.assistant && (narrativeLoading || narrativeData || narrativeError) && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">AI Match Summary</h2>
          {narrativeLoading && (
            <div className="card p-6 text-navy-300 text-sm animate-pulse">Generating coaching summary…</div>
          )}
          {narrativeError && (
            <div className="card p-6 text-navy-300 text-sm">AI summary unavailable for this match.</div>
          )}
          {narrativeData && !narrativeLoading && (
            <div className="card p-6 space-y-3">
              {narrativeData.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm text-navy-100 leading-relaxed">{para}</p>
              ))}
            </div>
          )}
        </section>
      )}

      <StatsCards stats={data.teamStats} />

      <section>
        <h2 className="text-lg font-semibold text-grey-900 mb-3">Set Breakdown</h2>
        {!data.setStats.length ? (
          <div className="card p-6 text-navy-300 text-sm">Record events to generate set analytics.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.setStats.map((set) => (
              <div key={set.setNumber} className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-grey-900">Set {set.setNumber}</h3>
                  <span className="tabular-nums text-xs text-navy-300">{set.totalEvents} events</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div><p className="tabular-nums text-lg">{set.kills}</p><p className="text-xs text-grey-600">Kills</p></div>
                  <div><p className="tabular-nums text-lg">{set.aces}</p><p className="text-xs text-grey-600">Aces</p></div>
                  <div><p className="tabular-nums text-lg">{set.digs}</p><p className="text-xs text-grey-600">Digs</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sprint 3 — Momentum */}
      {features.momentum && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Match Momentum</h2>
          {momentumData ? (
            <MomentumChart
              data={momentumData}
              teamName={data.match.teamName}
              opponentName={data.match.opponent}
            />
          ) : (
            <div className="card p-6 text-center text-navy-300 text-sm">Record scoring events to generate momentum analytics.</div>
          )}
        </section>
      )}

      {/* Sprint 5 — Advanced Metrics */}
      {features.recommendations && advancedData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Advanced Match Metrics</h2>
          <AdvancedMetricsPanel data={advancedData} heatmapData={heatmapData} />
        </section>
      )}

      {/* Sprint 4 — Rotation Analytics */}
      {features.rotationAnalytics && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Rotation Analytics</h2>
          {rotationData ? (
            <RotationAnalytics data={rotationData} />
          ) : (
            <div className="card p-6 text-center text-navy-300 text-sm">Loading rotation data...</div>
          )}
        </section>
      )}

      {/* Sprint 2 — Court Activity */}
      {features.heatMaps && heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Court Activity</h2>
          <CourtVisualization heatmapData={heatmapData} />
        </section>
      )}

      {/* Sprint 3 — Heat Map */}
      {features.heatMaps && heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Heat Map</h2>
          <HeatMapCourt data={heatmapData} />
        </section>
      )}

      {/* Phase 3 — Zone Efficiency */}
      {features.heatMaps && zoneDetail && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Zone Efficiency</h2>
          <CourtHeatMap data={zoneDetail} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-grey-900 mb-3">Player Statistics</h2>
        <PlayerStatsTable rows={data.playerStats} matchId={matchId} />
      </section>

      {/* Phase 6 Sprint 3 — Opponent Scouting */}
      {features.opponentScouting && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Opponent Scouting</h2>
          <OpponentScoutingPanel matchId={matchId!} />
        </section>
      )}

      {/* Phase 7 — Video footage */}
      {features.video && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Match Video</h2>
          <VideoPanel matchId={matchId!} />
        </section>
      )}
    </div>
  );
}
