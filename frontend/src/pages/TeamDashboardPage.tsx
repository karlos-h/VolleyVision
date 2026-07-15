import { useParams } from 'react-router-dom';
import { PlayerStatsTable, StatsCards } from '../components/analytics/StatsOverview';
import StatLeaderboardChart from '../components/charts/StatLeaderboardChart';
import { useTeamAnalytics, useTeamTrends, useTeamHeatmap, useTeamRotations, useTeamAdvanced, useTeamZoneDetail, useTeamRecommendations, useSeasonIntelligence, useTeamTrainingRecommendations, useAskAssistant } from '../hooks';
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
import AssistantPanel from '../components/analytics/AssistantPanel';
import TeamSubNav from '../components/ui/TeamSubNav';
import { features } from '../config/features';

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
  const { mutate: askAssistant, data: assistantAnswer, isPending: assistantPending } = useAskAssistant(teamId!);

  const insights =
  trends.data
    ? generateTeamInsights(trends.data)
    : [];


  if (isLoading) return <p className="text-navy-300">Loading analytics...</p>;
  if (isError || !data) return <p className="text-error">Couldn't load team analytics.</p>;

  return (
    <div className="space-y-6">
      <TeamSubNav teamId={data.team.id} teamName={data.team.name} />
      <div>
        <h1 className="text-2xl font-bold text-grey-900">{data.team.name} Dashboard</h1>
        <p className="text-sm text-grey-600 mt-1">
          {data.team.division && `${data.team.division} | `}Season {data.team.season}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(data.matchSummary).map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-navy-300">{label.replace(/([A-Z])/g, ' $1')}</p>
            <p className="tabular-nums text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <StatsCards stats={data.teamStats} />
        {trends.data && trends.data.length === 0 && (
        <div className="card p-6 text-center text-navy-300 text-sm">
          Complete matches to see performance trends over time.
        </div>
      )}

      {/* Phase 6 Sprint 4 — Season Intelligence */}
      {features.recommendations && seasonData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Season Intelligence</h2>
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
      {features.recommendations && advancedData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Advanced Performance Metrics</h2>
          <AdvancedMetricsPanel data={advancedData} heatmapData={heatmapData} />
        </section>
      )}

      {/* Phase 4 — Rotation Analytics */}
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

      {/* Phase 3 — Season Heat Map */}
      {features.heatMaps && heatmapData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Season Heat Map</h2>
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

      {/* Phase 6 Sprint 1 — Coaching Recommendations */}
      {features.recommendations && recommendationsData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Coaching Recommendations</h2>
          <CoachingRecommendationsPanel recommendations={recommendationsData} />
        </section>
      )}

      {/* Phase 6 Sprint 5 — Training Recommendations */}
      {features.recommendations && trainingData && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Practice Allocation</h2>
          <TrainingRecommendationsPanel recommendations={trainingData} />
        </section>
      )}

      {/* Phase 6 Sprint 6 — Coaching Assistant */}
      {features.assistant && (
        <section>
          <h2 className="text-lg font-semibold text-grey-900 mb-3">Coaching Assistant</h2>
          <AssistantPanel
            onAsk={askAssistant}
            answer={assistantAnswer}
            isPending={assistantPending}
          />
        </section>
      )}

      <CoachInsights insights={insights} />
      <PlayerInsights players={data.playerStats} />

      <section>
        <h2 className="text-lg font-semibold text-grey-900 mb-3">Season Player Statistics</h2>
        <PlayerStatsTable rows={data.playerStats} />
      </section>
    </div>
  );
}


