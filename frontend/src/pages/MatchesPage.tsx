import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useTeam, useMatches, useCreateMatch, useDeleteMatch } from '../hooks';

const STATUS_STYLES = {
  SCHEDULED: 'bg-blue-900/40 text-blue-300',
  IN_PROGRESS: 'bg-spike-600/30 text-spike-400',
  COMPLETED: 'bg-emerald-900/40 text-emerald-300',
  CANCELLED: 'bg-red-900/40 text-red-400',
};

export default function MatchesPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team } = useTeam(teamId!);
  const { data: matches, isLoading } = useMatches(teamId!);
  const createMatch = useCreateMatch();
  const deleteMatch = useDeleteMatch();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    matchDate: '',
    opponent: '',
    competition: '',
    venue: '',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const match = await createMatch.mutateAsync({ ...form, teamId: teamId! });
    navigate(`/track/${match.id}`);
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
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Match'}
        </button>
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
          <p className="text-chalk-400">No matches yet. Create one to start tracking.</p>
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
                  <Link to={`/track/${match.id}`} className="btn-primary text-sm py-1.5 px-3">
                    {match.status === 'COMPLETED' ? 'Events' : 'Track'}
                  </Link>
                  <button
                    className="text-chalk-600 hover:text-red-400 transition-colors text-xs px-1"
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
