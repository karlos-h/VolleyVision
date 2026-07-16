import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLeagueSeason, useSeasonFixtures, useMyTeams } from '../hooks';
import LeagueNavigation from '../components/league/LeagueNavigation';
import FixtureCard from '../components/league/FixtureCard';
import FixtureFiltersBar from '../components/league/FixtureFilters';

export default function FixturesPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data: season, isLoading: loadingSeason } = useLeagueSeason(seasonId!);
  const { data: myTeams = [] } = useMyTeams();

  const [teamId, setTeamId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const upcomingFilters = { status: 'upcoming' as const, teamId: teamId || undefined, from: from || undefined, to: to || undefined };
  const pendingFilters  = { status: 'pending'  as const, teamId: teamId || undefined, from: from || undefined, to: to || undefined };

  const { data: upcoming = [], isLoading: loadingUpcoming } = useSeasonFixtures(seasonId!, upcomingFilters);
  const { data: pending  = [], isLoading: loadingPending  } = useSeasonFixtures(seasonId!, pendingFilters);

  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const seasonTeams = season?.teams ?? [];

  const isLoading = loadingSeason || loadingUpcoming || loadingPending;

  if (loadingSeason) return <p className="text-chalk-400 text-sm">Loading…</p>;
  if (!season) return <p className="text-error text-sm">Season not found.</p>;

  return (
    <div className="space-y-6">
      <div className="text-xs text-chalk-500 flex gap-1 items-center">
        <Link to="/leagues" className="hover:text-chalk-300">League Hub</Link>
        <span>/</span>
        <Link to={`/leagues/seasons/${seasonId}`} className="hover:text-chalk-300">{season.league.name}</Link>
        <span>/</span>
        <span className="text-chalk-300">{season.name}</span>
        <span>/</span>
        <span className="text-chalk-300">Fixtures</span>
      </div>

      <div>
        <p className="text-xs text-chalk-500 font-semibold">
          {season.league.name}{season.league.division ? ` · ${season.league.division}` : ''}
        </p>
        <h1 className="text-2xl font-bold text-chalk-100 mt-0.5">{season.name} — Fixtures</h1>
      </div>

      <LeagueNavigation seasonId={seasonId!} />

      <FixtureFiltersBar
        teams={seasonTeams}
        teamId={teamId}
        from={from}
        to={to}
        onTeamId={setTeamId}
        onFrom={setFrom}
        onTo={setTo}
      />

      {isLoading ? (
        <p className="text-chalk-400 text-sm">Loading fixtures…</p>
      ) : (
        <>
          {/* Pending — date passed, still unresolved */}
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-warning flex items-center gap-2">
                Awaiting Result
                <span className="badge bg-warning/30 text-warning">{pending.length}</span>
              </h2>
              <div className="space-y-2">
                {pending.map((f) => (
                  <FixtureCard key={f.id} fixture={f} myTeamIds={myTeamIds} isPending />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 flex items-center gap-2">
              Upcoming
              <span className="badge bg-court-800 text-chalk-400">{upcoming.length}</span>
            </h2>
            {upcoming.length === 0 ? (
              <div className="card p-8 text-center text-chalk-500 text-sm">No upcoming fixtures.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((f) => (
                  <FixtureCard key={f.id} fixture={f} myTeamIds={myTeamIds} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
