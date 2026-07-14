import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLeagueSeason, useSeasonFixtures, useMyTeams } from '../hooks';
import LeagueNavigation from '../components/league/LeagueNavigation';
import ResultCard from '../components/league/ResultCard';
import FixtureFiltersBar from '../components/league/FixtureFilters';
import { resolveFixture } from '../lib/resolveFixture';

export default function ResultsPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data: season, isLoading: loadingSeason } = useLeagueSeason(seasonId!);
  const { data: myTeams = [] } = useMyTeams();

  const [teamId, setTeamId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = { status: 'completed' as const, teamId: teamId || undefined, from: from || undefined, to: to || undefined };
  const { data: fixtures = [], isLoading: loadingFixtures } = useSeasonFixtures(seasonId!, filters);

  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const seasonTeams = season?.teams ?? [];

  if (loadingSeason) return <p className="text-chalk-400 text-sm">Loading…</p>;
  if (!season) return <p className="text-error text-sm">Season not found.</p>;

  // Resolve all fixture results via the shared util — the home/away naming
  // nuance is encapsulated there; this page never re-derives it.
  const resolved = fixtures.map((f) => ({ fixture: f, result: resolveFixture(f) }));
  const discrepancyCount = resolved.filter((r) => r.result.hasDiscrepancy).length;

  return (
    <div className="space-y-6">
      <div className="text-xs text-chalk-500 flex gap-1 items-center">
        <Link to="/leagues" className="hover:text-chalk-300">League Hub</Link>
        <span>/</span>
        <Link to={`/leagues/seasons/${seasonId}`} className="hover:text-chalk-300">{season.league.name}</Link>
        <span>/</span>
        <span className="text-chalk-300">{season.name}</span>
        <span>/</span>
        <span className="text-chalk-300">Results</span>
      </div>

      <div>
        <p className="text-xs text-chalk-500 font-semibold">
          {season.league.name}{season.league.division ? ` · ${season.league.division}` : ''}
        </p>
        <h1 className="text-2xl font-bold text-chalk-100 mt-0.5">{season.name} — Results</h1>
      </div>

      <LeagueNavigation seasonId={seasonId!} />

      {discrepancyCount > 0 && (
        <div className="card p-3 border-l-4 border-warning/50 bg-warning/10 text-xs text-warning">
          {discrepancyCount} result{discrepancyCount > 1 ? 's have' : ' has'} conflicting data between teams.
          Home team data is used as authoritative. Hover the ⚠ icon on each card for details.
        </div>
      )}

      <FixtureFiltersBar
        teams={seasonTeams}
        teamId={teamId}
        from={from}
        to={to}
        onTeamId={setTeamId}
        onFrom={setFrom}
        onTo={setTo}
      />

      {loadingFixtures ? (
        <p className="text-chalk-400 text-sm">Loading results…</p>
      ) : resolved.length === 0 ? (
        <div className="card p-10 text-center text-chalk-500 text-sm">
          No results yet. Results appear once teams link their completed match records.
        </div>
      ) : (
        <div className="space-y-2">
          {resolved.map(({ fixture, result }) => (
            <ResultCard key={fixture.id} fixture={fixture} result={result} myTeamIds={myTeamIds} />
          ))}
        </div>
      )}
    </div>
  );
}
