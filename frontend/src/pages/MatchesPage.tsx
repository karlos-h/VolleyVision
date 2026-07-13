import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useTeam, useMatches, useCreateMatch, useDeleteMatch } from '../hooks';
import { isPendingApproval } from '../types';

const STATUS_STYLES = {
  SCHEDULED: 'bg-info/40 text-info',
  IN_PROGRESS: 'bg-spike-600/30 text-spike-400',
  COMPLETED: 'bg-success/40 text-success-dark',
  CANCELLED: 'bg-error/40 text-error-dark',
};

const MATCH_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export default function MatchesPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team } = useTeam(teamId!);

  const [filters, setFilters] = useState({ opponent: '', status: '', from: '', to: '' });
  const activeFilters = {
    opponent: filters.opponent || undefined,
    status:   filters.status   || undefined,
    from:     filters.from     || undefined,
    to:       filters.to       || undefined,
  };

  const { data: matches, isLoading } = useMatches(teamId!, activeFilters);
  const createMatch = useCreateMatch();
  const deleteMatch = useDeleteMatch();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [pendingNotice, setPendingNotice] = useState('');
  const [form, setForm] = useState({
    matchDate: '',
    opponent: '',
    competition: '',
    venue: '',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const opponent = form.opponent;
    const result = await createMatch.mutateAsync({ ...form, teamId: teamId! });
    // Non-head-coach creates are queued — no match exists yet, so don't jump to
    // tracking; confirm it's awaiting approval instead.
    if (isPendingApproval(result)) {
      setShowForm(false);
      setForm({ matchDate: '', opponent: '', competition: '', venue: '' });
      setPendingNotice(`Match vs ${opponent} submitted for the head coach's approval.`);
      return;
    }
    navigate(`/track/${result.id}`);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-chalk-400">
        <Link to="/teams" className="hover:text-chalk-200">Teams</Link>
        <span>/</span>
        <Link to={`/teams/${teamId}`} className="hover:text-chalk-200">{team?.name}</Link>
        <span>/</span>
        <span className="text-chalk-100">Matches</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">Matches</h1>
          <p className="text-chalk-400 text-sm mt-0.5">{team?.name}</p>
        </div>
        <button className={showForm ? 'btn-secondary' : 'btn-primary'} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New match'}
        </button>
      </div>

      {/* Pending-approval confirmation */}
      {pendingNotice && (
        <div className="card p-4 border border-gold-500/30 bg-gold-500/10 text-sm text-chalk-100 flex items-center justify-between gap-3">
          <span>{pendingNotice}</span>
          <button className="text-chalk-500 hover:text-chalk-200 text-xs" onClick={() => setPendingNotice('')}>Dismiss</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-chalk-400 mb-1">Opponent</label>
          <input
            className="input text-sm"
            placeholder="Search opponent…"
            value={filters.opponent}
            onChange={(e) => setFilters({ ...filters, opponent: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-chalk-400 mb-1">Status</label>
          <select
            className="input text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {MATCH_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-chalk-400 mb-1">From</label>
          <input
            type="date"
            className="input text-sm"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-chalk-400 mb-1">To</label>
          <input
            type="date"
            className="input text-sm"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        {(filters.opponent || filters.status || filters.from || filters.to) && (
          <div className="sm:col-span-4">
            <button
              className="text-xs text-chalk-400 hover:text-chalk-100 transition-colors"
              onClick={() => setFilters({ opponent: '', status: '', from: '', to: '' })}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-chalk-100 mb-4">New Match</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                className="input"
                value={form.matchDate}
                onChange={(e) => setForm({ ...form, matchDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Opponent *</label>
              <input
                className="input"
                placeholder="e.g. Wellington Wolves"
                value={form.opponent}
                onChange={(e) => setForm({ ...form, opponent: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Competition</label>
              <input
                className="input"
                placeholder="e.g. National League"
                value={form.competition}
                onChange={(e) => setForm({ ...form, competition: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Venue</label>
              <input
                className="input"
                placeholder="e.g. Cowles Stadium"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
              />
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
        <p className="text-chalk-400 text-sm">Loading…</p>
      ) : matches?.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-chalk-400">No matches yet — record your first match to unlock your stats.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches?.map((match) => (
            <div key={match.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-chalk-100">vs {match.opponent}</span>
                  <span className={`badge ${STATUS_STYLES[match.status]}`}>{match.status}</span>
                </div>
                <p className="text-chalk-400 text-xs mt-0.5">
                  {format(new Date(match.matchDate), 'PPP p')}
                  {match.venue && ` · ${match.venue}`}
                  {match.competition && ` · ${match.competition}`}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-xs text-chalk-400">
                  {match._count?.events ?? 0} events
                </div>
                <div className="flex gap-2 mt-1">
                  <Link to={`/matches/${match.id}/dashboard`} className="btn-secondary text-sm py-1.5 px-3">
                    Stats
                  </Link>
                  <Link to={`/track/${match.id}`} className="btn-secondary text-sm py-1.5 px-3">
                    {match.status === 'COMPLETED' ? 'Events' : 'Track'}
                  </Link>
                  <button
                    className="text-chalk-600 hover:text-error-dark transition-colors text-xs px-1"
                    onClick={() => {
                      if (confirm(`Delete match vs ${match.opponent}? This cannot be undone.`)) {
                        deleteMatch.mutate({ id: match.id, teamId: teamId! });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
