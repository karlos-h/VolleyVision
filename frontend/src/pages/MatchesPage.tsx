import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useTeam, useMatches, useCreateMatch, useUpdateMatch, useDeleteMatch, useHasPermission } from '../hooks';
import { isPendingApproval, leagueLabel } from '../types';
import TeamSubNav from '../components/ui/TeamSubNav';
import { TrashIcon } from '../components/ui/icons';

const STATUS_STYLES = {
  SCHEDULED: 'badge-info',
  IN_PROGRESS: 'badge-accent',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-error',
};

const MATCH_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export default function MatchesPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team } = useTeam(teamId!);

  // Match-management is tiered; live tracking is a separate permission. Players
  // hold neither, so they only ever see Stats + Events.
  const canManageMatches = useHasPermission(teamId!, 'CREATE_MATCH');
  const canDeleteMatches = useHasPermission(teamId!, 'DELETE_MATCH');
  const canTrack = useHasPermission(teamId!, 'TRACK_MATCH');

  const [filters, setFilters] = useState({ opponent: '', status: '', from: '', to: '' });
  const activeFilters = {
    opponent: filters.opponent || undefined,
    status:   filters.status   || undefined,
    from:     filters.from     || undefined,
    to:       filters.to       || undefined,
  };

  const { data: matches, isLoading } = useMatches(teamId!, activeFilters);
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [pendingNotice, setPendingNotice] = useState('');
  const [form, setForm] = useState({ matchDate: '', opponent: '', competition: '', venue: '' });

  // Competition defaults to the team's current league (Task 2), still editable.
  function openForm() {
    setForm((f) => ({ ...f, competition: f.competition || leagueLabel(team?.leagueSeason) || '' }));
    setShowForm(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const opponent = form.opponent;
    const result = await createMatch.mutateAsync({ ...form, teamId: teamId! });
    if (isPendingApproval(result)) {
      setShowForm(false);
      setForm({ matchDate: '', opponent: '', competition: '', venue: '' });
      setPendingNotice(`Match vs ${opponent} submitted for the head coach's approval.`);
      return;
    }
    // Created immediately — start it (SCHEDULED → IN_PROGRESS) so tracking, which
    // is restricted to in-progress matches, can open.
    await updateMatch.mutateAsync({ id: result.id, data: { status: 'IN_PROGRESS' } });
    navigate(`/track/${result.id}`);
  }

  // Begin a scheduled match, then open the live tracker.
  async function startAndTrack(id: string) {
    const res = await updateMatch.mutateAsync({ id, data: { status: 'IN_PROGRESS' } });
    if (isPendingApproval(res)) {
      setPendingNotice('Starting this match was submitted for the head coach approval.');
      return;
    }
    navigate(`/track/${id}`);
  }

  return (
    <div className="space-y-6">
      <TeamSubNav teamId={teamId!} teamName={team?.name} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-grey-900">Matches</h1>
          <p className="text-grey-600 text-sm mt-0.5">{team?.name}</p>
        </div>
        {canManageMatches && (
          <button className={showForm ? 'btn-secondary' : 'btn-primary'} onClick={() => (showForm ? setShowForm(false) : openForm())}>
            {showForm ? 'Cancel' : '+ New match'}
          </button>
        )}
      </div>

      {pendingNotice && (
        <div className="card p-4 border border-gold-500/40 bg-gold-500/10 text-sm text-grey-900 flex items-center justify-between gap-3">
          <span>{pendingNotice}</span>
          <button className="text-grey-500 hover:text-grey-900 text-xs" onClick={() => setPendingNotice('')}>Dismiss</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-grey-600 mb-1">Opponent</label>
          <input className="input text-sm" placeholder="Search opponent…" value={filters.opponent} onChange={(e) => setFilters({ ...filters, opponent: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-grey-600 mb-1">Status</label>
          <select className="input text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {MATCH_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-grey-600 mb-1">From</label>
          <input type="date" className="input text-sm" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-grey-600 mb-1">To</label>
          <input type="date" className="input text-sm" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        {(filters.opponent || filters.status || filters.from || filters.to) && (
          <div className="sm:col-span-4">
            <button className="text-xs text-grey-600 hover:text-grey-900 transition-colors" onClick={() => setFilters({ opponent: '', status: '', from: '', to: '' })}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-grey-900 mb-4">New Match</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-grey-600 mb-1">Date & Time *</label>
              <input type="datetime-local" className="input" value={form.matchDate} onChange={(e) => setForm({ ...form, matchDate: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs text-grey-600 mb-1">Opponent *</label>
              <input className="input" placeholder="e.g. Wellington Wolves" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs text-grey-600 mb-1">
                Competition{team?.leagueSeason ? ' (from your league)' : ''}
              </label>
              <input className="input" placeholder="e.g. National League" value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-grey-600 mb-1">Venue</label>
              <input className="input" placeholder="e.g. Cowles Stadium" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={createMatch.isPending}>
                {createMatch.isPending ? 'Creating…' : 'Create & Start Tracking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Matches list */}
      {isLoading ? (
        <p className="text-grey-600 text-sm">Loading…</p>
      ) : matches?.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-grey-600">No matches yet — record your first match to unlock your stats.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches?.map((match) => (
            <div key={match.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-grey-900">vs {match.opponent}</span>
                  <span className={`badge ${STATUS_STYLES[match.status]}`}>{match.status.replace('_', ' ')}</span>
                </div>
                <p className="text-grey-600 text-xs mt-0.5">
                  {format(new Date(match.matchDate), 'PPP p')}
                  {match.venue && ` · ${match.venue}`}
                  {match.competition && ` · ${match.competition}`}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-grey-500 tabular-nums">{match._count?.events ?? 0} events</div>
                <div className="flex gap-2 mt-1 justify-end">
                  <Link to={`/matches/${match.id}/dashboard`} className="btn-secondary text-sm py-1.5 px-3">Stats</Link>
                  <Link to={`/matches/${match.id}/events`} className="btn-secondary text-sm py-1.5 px-3">Events</Link>

                  {/* Live tracking: coaches/staff only, and only for a live or startable match. */}
                  {canTrack && match.status === 'IN_PROGRESS' && (
                    <Link to={`/track/${match.id}`} className="btn-primary text-sm py-1.5 px-3">Track</Link>
                  )}
                  {canTrack && match.status === 'SCHEDULED' && (
                    <button
                      className="btn-primary text-sm py-1.5 px-3"
                      disabled={updateMatch.isPending}
                      onClick={() => startAndTrack(match.id)}
                    >
                      Start
                    </button>
                  )}

                  {canDeleteMatches && (
                    <button
                      className="btn-icon-danger"
                      title="Delete match"
                      aria-label={`Delete match vs ${match.opponent}`}
                      onClick={() => {
                        if (confirm(`Delete match vs ${match.opponent}? This cannot be undone.`)) {
                          deleteMatch.mutate({ id: match.id, teamId: teamId! });
                        }
                      }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
