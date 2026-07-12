import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  useLeagueSeason,
  useSeasonFixtures,
  useMyTeams,
  useAddTeamToSeason,
  useCreateFixture,
  useLinkMatch,
  useUnlinkMatch,
} from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { matchesApi, teamsApi } from '../lib/api';
import LeagueNavigation from '../components/league/LeagueNavigation';
import type { LeagueMatch } from '../types';

// ─── Fixture row ──────────────────────────────────────────────────────────────

function FixtureRow({ fixture, myTeamIds, onLink, onUnlink }: {
  fixture: LeagueMatch;
  myTeamIds: Set<string>;
  onLink: (fixtureId: string, side: 'home' | 'away') => void;
  onUnlink: (fixtureId: string, side: 'home' | 'away') => void;
}) {
  const homeTeamId = fixture.homeLeagueTeam.teamId;
  const awayTeamId = fixture.awayLeagueTeam.teamId;
  const iMyHome = myTeamIds.has(homeTeamId);
  const iMyAway = myTeamIds.has(awayTeamId);

  return (
    <div className="card p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {/* Scheduled date */}
      <span className="text-chalk-500 text-xs shrink-0 w-28">
        {new Date(fixture.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>

      {/* Matchup */}
      <div className="flex-1 flex items-center gap-2 text-sm">
        <span className={`font-medium ${iMyHome ? 'text-spike-400' : 'text-chalk-300'}`}>
          {fixture.homeLeagueTeam.team.name}
        </span>
        <span className="text-chalk-600 text-xs">vs</span>
        <span className={`font-medium ${iMyAway ? 'text-spike-400' : 'text-chalk-300'}`}>
          {fixture.awayLeagueTeam.team.name}
        </span>
      </div>

      {/* Link status + actions */}
      <div className="flex gap-2 items-center text-xs">
        {/* Home side */}
        {fixture.homeMatch ? (
          <Link to={`/matches/${fixture.homeMatch.id}/dashboard`} className="badge bg-success/30 text-success-dark">
            Home: {fixture.homeMatch.homeSetsWon}–{fixture.homeMatch.awaySetsWon}
          </Link>
        ) : iMyHome ? (
          <button onClick={() => onLink(fixture.id, 'home')} className="badge bg-court-800 text-chalk-400 hover:text-chalk-200 cursor-pointer">
            Link home match
          </button>
        ) : (
          <span className="badge bg-court-900 text-chalk-600">Home: unlinked</span>
        )}

        {/* Away side */}
        {fixture.awayMatch ? (
          <Link to={`/matches/${fixture.awayMatch.id}/dashboard`} className="badge bg-success/30 text-success-dark">
            Away: {fixture.awayMatch.homeSetsWon}–{fixture.awayMatch.awaySetsWon}
          </Link>
        ) : iMyAway ? (
          <button onClick={() => onLink(fixture.id, 'away')} className="badge bg-court-800 text-chalk-400 hover:text-chalk-200 cursor-pointer">
            Link away match
          </button>
        ) : (
          <span className="badge bg-court-900 text-chalk-600">Away: unlinked</span>
        )}

        {/* Unlink buttons for own sides */}
        {fixture.homeMatch && iMyHome && (
          <button onClick={() => onUnlink(fixture.id, 'home')} className="text-chalk-600 hover:text-error-dark text-xs">✕</button>
        )}
        {fixture.awayMatch && iMyAway && (
          <button onClick={() => onUnlink(fixture.id, 'away')} className="text-chalk-600 hover:text-error-dark text-xs">✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Link match modal ─────────────────────────────────────────────────────────

function LinkMatchModal({ fixtureId, side, onDone }: { fixtureId: string; side: 'home' | 'away'; onDone: () => void }) {
  // Load owned teams first, then their matches
  const { data: myTeams = [] } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches', 'link-picker', myTeams.map((t: any) => t.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(myTeams.map((t: any) => matchesApi.listByTeam(t.id)));
      return results.flat();
    },
    enabled: myTeams.length > 0,
  });
  const link = useLinkMatch();
  const [matchId, setMatchId] = useState('');
  const [err, setErr] = useState('');

  async function handleLink() {
    if (!matchId) { setErr('Select a match.'); return; }
    setErr('');
    try {
      await link.mutateAsync({ fixtureId, matchId, side });
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Couldn't link that match. Check the details and try again.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold text-chalk-100">Link {side} match</h3>
        {err && <p className="text-error-dark text-xs">{err}</p>}
        {isLoading ? (
          <p className="text-chalk-400 text-sm">Loading matches…</p>
        ) : (
          <select className="input w-full" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">Select match…</option>
            {matches.map((m: any) => (
              <option key={m.id} value={m.id}>
                {new Date(m.matchDate).toLocaleDateString()} vs {m.opponent}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={handleLink} disabled={link.isPending} className="btn-primary flex-1 text-sm">
            {link.isPending ? 'Linking…' : 'Link'}
          </button>
          <button onClick={onDone} className="btn-secondary flex-1 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add team form ────────────────────────────────────────────────────────────

function AddTeamForm({ seasonId, existingTeamIds, onDone }: { seasonId: string; existingTeamIds: Set<string>; onDone: () => void }) {
  const { data: myTeams = [] } = useMyTeams();
  const addTeam = useAddTeamToSeason();
  const [teamId, setTeamId] = useState('');
  const [err, setErr] = useState('');

  const available = myTeams.filter((t) => !existingTeamIds.has(t.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) { setErr('Select a team.'); return; }
    setErr('');
    try {
      await addTeam.mutateAsync({ seasonId, teamId });
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Couldn't add that team. Try again.");
    }
  }

  if (!available.length) {
    return (
      <div className="card p-4 text-sm text-chalk-400">
        All your teams are already in this season.
        <button onClick={onDone} className="ml-3 text-xs text-chalk-500 underline">dismiss</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleAdd} className="card p-4 flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-xs text-chalk-500 mb-1 block">Add one of your teams</label>
        {err && <p className="text-error-dark text-xs mb-1">{err}</p>}
        <select className="input w-full" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
          <option value="">Select team…</option>
          {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={addTeam.isPending} className="btn-secondary text-sm py-2">
        {addTeam.isPending ? 'Adding…' : 'Add'}
      </button>
      <button type="button" onClick={onDone} className="btn-secondary text-sm py-2">Cancel</button>
    </form>
  );
}

// ─── Create fixture form (admin only) ─────────────────────────────────────────

function CreateFixtureForm({ seasonId, leagueTeams, onDone }: {
  seasonId: string;
  leagueTeams: Array<{ id: string; team: { name: string } }>;
  onDone: () => void;
}) {
  const create = useCreateFixture();
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [date, setDate] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (home === away) { setErr('Home and away must be different.'); return; }
    setErr('');
    try {
      await create.mutateAsync({ seasonId, homeLeagueTeamId: home, awayLeagueTeamId: away, scheduledDate: date });
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? "Couldn't create the fixture. Check the details and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3 mt-4">
      <h3 className="font-semibold text-chalk-200 text-sm">Create Fixture</h3>
      {err && <p className="text-error-dark text-xs">{err}</p>}
      <div className="flex gap-2">
        <select className="input flex-1" value={home} onChange={(e) => setHome(e.target.value)} required>
          <option value="">Home team *</option>
          {leagueTeams.map((lt) => <option key={lt.id} value={lt.id}>{lt.team.name}</option>)}
        </select>
        <select className="input flex-1" value={away} onChange={(e) => setAway(e.target.value)} required>
          <option value="">Away team *</option>
          {leagueTeams.map((lt) => <option key={lt.id} value={lt.id}>{lt.team.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-chalk-500 mb-1 block">Scheduled date *</label>
        <input className="input w-full" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-1.5">
          {create.isPending ? 'Creating…' : 'Create fixture'}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </form>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LeagueSeasonPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { user } = useAuth();
  const { data: season, isLoading: loadingSeason } = useLeagueSeason(seasonId!);
  const { data: fixtures = [], isLoading: loadingFixtures } = useSeasonFixtures(seasonId!);
  const { data: myTeams = [] } = useMyTeams();
  const unlink = useUnlinkMatch();

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showCreateFixture, setShowCreateFixture] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ fixtureId: string; side: 'home' | 'away' } | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const existingTeamIds = new Set(season?.teams.map((lt) => lt.teamId) ?? []);
  const iCanJoin = myTeams.some((t) => !existingTeamIds.has(t.id));

  function handleUnlink(fixtureId: string, side: 'home' | 'away') {
    if (window.confirm(`Unlink the ${side} match from this fixture?`)) {
      unlink.mutate({ fixtureId, side });
    }
  }

  if (loadingSeason) return <p className="text-chalk-400 text-sm">Loading…</p>;
  if (!season) return <p className="text-error-dark text-sm">Season not found.</p>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-chalk-500 flex gap-1 items-center">
        <Link to="/leagues" className="hover:text-chalk-300">League Hub</Link>
        <span>/</span>
        <span className="text-chalk-300">{season.league.name}</span>
        <span>/</span>
        <span className="text-chalk-300">{season.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-chalk-500 font-semibold">
            {season.league.name}{season.league.division ? ` · ${season.league.division}` : ''}
          </p>
          <h1 className="text-2xl font-bold text-chalk-100 mt-0.5">{season.name}</h1>
          <p className="text-chalk-500 text-xs mt-1">
            {new Date(season.startDate).toLocaleDateString()} {season.endDate ? `– ${new Date(season.endDate).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {iCanJoin && (
            <button onClick={() => setShowAddTeam((v) => !v)} className="btn-secondary text-sm">
              Join season
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowCreateFixture((v) => !v)} className={showCreateFixture ? 'btn-secondary text-sm' : 'btn-primary text-sm'}>
              + Fixture
            </button>
          )}
        </div>
      </div>

      <LeagueNavigation seasonId={seasonId!} />

      {showAddTeam && (
        <AddTeamForm seasonId={seasonId!} existingTeamIds={existingTeamIds} onDone={() => setShowAddTeam(false)} />
      )}

      {showCreateFixture && (
        <CreateFixtureForm seasonId={seasonId!} leagueTeams={season.teams} onDone={() => setShowCreateFixture(false)} />
      )}

      {/* Teams */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-chalk-400">Teams ({season.teams.length})</h2>
        <div className="flex flex-wrap gap-2">
          {season.teams.map((lt) => (
            <span
              key={lt.id}
              className={`badge text-sm py-1 px-3 ${myTeamIds.has(lt.teamId) ? 'bg-spike-600/20 text-spike-400' : 'bg-court-800 text-chalk-300'}`}
            >
              {lt.team.name}
            </span>
          ))}
        </div>
      </section>

      {/* Fixtures */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-chalk-400">Fixtures ({fixtures.length})</h2>
        {loadingFixtures ? (
          <p className="text-chalk-400 text-sm">Loading fixtures…</p>
        ) : !fixtures.length ? (
          <div className="card p-8 text-center text-chalk-500 text-sm">
            No fixtures scheduled yet.
            {isAdmin && <span> Use the "+ Fixture" button to add one.</span>}
          </div>
        ) : (
          <div className="space-y-2">
            {fixtures.map((f) => (
              <FixtureRow
                key={f.id}
                fixture={f}
                myTeamIds={myTeamIds}
                onLink={(fixtureId, side) => setLinkTarget({ fixtureId, side })}
                onUnlink={handleUnlink}
              />
            ))}
          </div>
        )}
      </section>

      {linkTarget && (
        <LinkMatchModal
          fixtureId={linkTarget.fixtureId}
          side={linkTarget.side}
          onDone={() => setLinkTarget(null)}
        />
      )}
    </div>
  );
}
