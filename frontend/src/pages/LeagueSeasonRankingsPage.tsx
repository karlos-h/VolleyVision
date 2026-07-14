import { useParams } from 'react-router-dom';
import { useSeasonRankings } from '../hooks';
import LeagueNavigation from '../components/league/LeagueNavigation';
import LeagueRankingCards from '../components/league/LeagueRankingCards';
import LeagueLeaderboards from '../components/league/LeagueLeaderboards';

export default function LeagueSeasonRankingsPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data, isLoading, error } = useSeasonRankings(seasonId!);

  return (
    <div className="space-y-8 max-w-5xl">
      <LeagueNavigation seasonId={seasonId!} />

      <div>
        <h1 className="text-xl font-bold text-chalk-100">League rankings</h1>
        <p className="text-chalk-500 text-sm mt-0.5">
          Computed from linked, completed league fixtures only. Min. 2 matches to appear.
        </p>
      </div>

      {isLoading && <p className="text-chalk-400 text-sm">Loading rankings…</p>}
      {error && <p className="text-error text-sm">Failed to load rankings.</p>}

      {data && (
        <>
          {/* Team Rankings */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-chalk-300 border-b border-court-700 pb-1">
              Team Rankings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <LeagueRankingCards
                title="Attack Efficiency"
                entries={data.teamRankings.attackEfficiency}
                formatValue={(v) => v.toFixed(3)}
              />
              <LeagueRankingCards
                title="Serve Efficiency"
                entries={data.teamRankings.serveEfficiency}
                formatValue={(v) => `${(v * 100).toFixed(1)}%`}
              />
              <LeagueRankingCards
                title="Blocking"
                entries={data.teamRankings.blocking}
                formatValue={(v) => v.toFixed(1)}
              />
              <LeagueRankingCards
                title="Defense (Digs)"
                entries={data.teamRankings.defense}
                formatValue={(v) => String(v)}
              />
            </div>
          </section>

          {/* Player Leaderboards */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-chalk-300 border-b border-court-700 pb-1">
              Player Leaderboards
            </h2>
            <LeagueLeaderboards
              kills={data.playerLeaderboards.kills}
              aces={data.playerLeaderboards.aces}
              blocks={data.playerLeaderboards.blocks}
              digs={data.playerLeaderboards.digs}
              assists={data.playerLeaderboards.assists}
            />
          </section>
        </>
      )}
    </div>
  );
}
