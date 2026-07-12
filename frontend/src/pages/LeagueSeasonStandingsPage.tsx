import { useParams, Link } from 'react-router-dom';
import { useLeagueSeason, useSeasonStandings } from '../hooks';
import LeagueNavigation from '../components/league/LeagueNavigation';
import StandingsTable from '../components/league/StandingsTable';

export default function LeagueSeasonStandingsPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data: season, isLoading: loadingSeason } = useLeagueSeason(seasonId!);
  const { data: result, isLoading: loadingStandings } = useSeasonStandings(seasonId!);

  if (loadingSeason) return <p className="text-chalk-400 text-sm">Loading…</p>;
  if (!season) return <p className="text-error-dark text-sm">Season not found.</p>;

  const discrepancies = result?.fixtureResults.filter((f) => f.hasDiscrepancy) ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-chalk-500 flex gap-1 items-center">
        <Link to="/leagues" className="hover:text-chalk-300">League Hub</Link>
        <span>/</span>
        <Link to={`/leagues/seasons/${seasonId}`} className="hover:text-chalk-300">{season.league.name}</Link>
        <span>/</span>
        <span className="text-chalk-300">{season.name}</span>
        <span>/</span>
        <span className="text-chalk-300">Standings</span>
      </div>

      {/* Header */}
      <div>
        <p className="text-xs text-chalk-500 font-semibold">
          {season.league.name}{season.league.division ? ` · ${season.league.division}` : ''}
        </p>
        <h1 className="text-2xl font-bold text-chalk-100 mt-0.5">{season.name} — Standings</h1>
      </div>

      <LeagueNavigation seasonId={seasonId!} />

      {discrepancies.length > 0 && (
        <div className="card p-4 border-l-4 border-warning/60 bg-warning/10 space-y-1">
          <p className="text-warning text-sm font-medium">
            {discrepancies.length} fixture{discrepancies.length > 1 ? 's have' : ' has'} conflicting match data
          </p>
          <p className="text-chalk-500 text-xs">
            Both sides linked different results. The home team's data is used as authoritative for these fixtures.
          </p>
        </div>
      )}

      {loadingStandings ? (
        <p className="text-chalk-400 text-sm">Computing standings…</p>
      ) : (
        <StandingsTable rows={result?.standings ?? []} />
      )}
    </div>
  );
}
