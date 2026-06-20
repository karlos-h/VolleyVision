import { Link, useParams } from 'react-router-dom';
import { PlayerStatsTable, StatsCards } from '../components/analytics/StatsOverview';
import StatLeaderboardChart from '../components/charts/StatLeaderboardChart';
import { useTeamAnalytics, useTeamTrends, useTeamHeatmap, useTeamRotations, useTeamAdvanced, useTeamZoneDetail, useTeamRecommendations, useSeasonIntelligence, useTeamTrainingRecommendations } from '../hooks';
import TeamTrendChart from '../components/charts/TeamTrendChart';
import CoachInsights from '../components/analytics/CoachInsights';
import { generateTeamInsights } from '../lib/insights';
import PlayerInsights from '../components/analytics/PlayerInsights';
import HeatMapCourt from '../components/court/HeatMapCourt';
import CourtHeatMap from '../components/analytics/CourtHeatMap';
import RotationAnalytics from '../components/analytics/RotationAnalytics';
import AdvancedMetricsPanel from '../components/analytics/AdvancedMetricsPanel';
import CoachingRecommendationsPanel from '../components/analytics/CoachingRecommendationsPanel';
import SeasonIntelligenceCard from '../components/analytics/SeasonIntelligenceCard';
import TrainingRecommendationsPanel from '../components/analytics/TrainingRecommendationsPanel';

export default function TeamDashboardPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data, isLoading, isError } = useTeamAnalytics(teamId!);
  const trends = useTeamTrends(teamId!);
  const { data: heatmapData } = useTeamHeatmap(teamId!);
  const { data: zoneDetail } = useTeamZoneDetail(teamId!);
  const { data: rotationData } = useTeamRotations(teamId!);
  const { data: advancedData } = useTeamAdvanced(teamId!);
  const { data: recommendationsData } = useTeamRecommendations(teamId!);
  const { data: seasonData } = useSeasonIntelligence(teamId!);
  const { data: trainingData } = useTeamTrainingRecommendations(teamId!);

  const insights =
  trends.data
    ? generateTeamInsights(trends.data)
    : [];


  if (isLoading) return <p className="text-chalk-400">Loading analytics...</p>;
  if (isError || !data) return <p className="text-red-400">Unable to load team analytics.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/teams/${data.team.id}`} className="text-sm text-chalk-400 hover:text-chalk-100">
          Back to roster
        </Link>
        <h1 className="text-2xl font-bold text-chalk-100 mt-2">{data.team.name} Dashboard</h1>
        <p className="text-sm text-chalk-400 mt-1">
          {data.team.division && `${data.team.division} | `}Season {data.team.season}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(data.matchSummary).map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs uppercase tracking-wider text-chalk-400">{label.replace(/([A-Z])/g, ' $1')}</p>
            <p className="font-mono text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <StatsCards stats={data.teamStats} />
        {trends.data && trends.data.length === 0 && (
        <div className="card p-6 text-center text-chalk-400 text-sm">
          Complete matches to see performance trends over time.
        </div>
      )}

      {/* Phase 6 Sprint 4 — Season Intelligence */}
      {seasonData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Season Intelligence</h2>
          <SeasonIntelligenceCard report={seasonData} />
        </section>
      )}

      {trends.data && trends.data.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-4">
            <TeamTrendChart
              title="Kills Trend"
              data={trends.data}
              dataKey="kills"
            />

            <TeamTrendChart
              title="Aces Trend"
              data={trends.data}
              dataKey="aces"
            />

            <TeamTrendChart
              title="Blocks Trend"
              data={trends.data}
              dataKey="blocks"
            />

            <TeamTrendChart
              title="Digs Trend"
              data={trends.data}
              dataKey="digs"
            />

            <TeamTrendChart
              title="Hitting % Trend"
              data={trends.data}
              dataKey="hittingPercentage"
            />
          </div>
        )}
      <div className="grid md:grid-cols-2 gap-4">
        <StatLeaderboardChart
          title="Top Killers"
          players={data.playerStats}
          metric="kills"
        />

        <StatLeaderboardChart
          title="Top Aces"
          players={data.playerStats}
          metric="aces"
        />

        <StatLeaderboardChart
          title="Top Blocks"
          players={data.playerStats}
          metric="totalBlocks"
        />

        <StatLeaderboardChart
          title="Top Digs"
          players={data.playerStats}
          metric="digs"
        />
      </div>
      
      {/* Phase 4 Sprint 5 — Advanced Metrics */}
      {advancedData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Advanced Performance Metrics</h2>
          <AdvancedMetricsPanel data={advancedData} heatmapData={heatmapData} />
        </section>
      )}

      {/* Phase 4 — Rotation Analytics */}
      <section>
        <h2 className="text-lg font-semibold text-chalk-100 mb-3">Rotation Analytics</h2>
        {rotationData ? (
          <RotationAnalytics data={rotationData} />
        ) : (
          <div className="card p-6 text-center text-chalk-400 text-sm">Loading rotation data...</div>
        )}
      </section>

      {/* Phase 3 — Season Heat Map */}
      {heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Season Heat Map</h2>
          <HeatMapCourt data={heatmapData} />
        </section>
      )}

      {/* Phase 3 — Zone Efficiency */}
      {zoneDetail && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Zone Efficiency</h2>
          <CourtHeatMap data={zoneDetail} />
        </section>
      )}

      {/* Phase 6 Sprint 1 — Coaching Recommendations */}
      {recommendationsData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Coaching Recommendations</h2>
          <CoachingRecommendationsPanel recommendations={recommendationsData} />
        </section>
      )}

      {/* Phase 6 Sprint 5 — Training Recommendations */}
      {trainingData && (
        <section>
          <h2 className="text-lg font-semibold text-chalk-100 mb-3">Practice Allocation</h2>
          <TrainingRecommendationsPanel recommendations={trainingData} />
        </section>
      )}

      <CoachInsights insights={insights} />
      <PlayerInsights players={data.playerStats} />

      <section>
        <h2 className="text-lg font-semibold text-chalk-100 mb-3">Season Player Statistics</h2>
        <PlayerStatsTable rows={data.playerStats} />
      </section>
    </div>
  );
}


