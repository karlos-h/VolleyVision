import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTeam, useCreatePlayer, useDeletePlayer, useUpdatePlayer } from '../hooks';
import type { Position } from '../types';
import { POSITION_LABELS } from '../types';

const POSITIONS: Position[] = [
  'SETTER',
  'OUTSIDE_HITTER',
  'OPPOSITE',
  'MIDDLE_BLOCKER',
  'LIBERO',
  'DEFENSIVE_SPECIALIST',
];

const POSITION_COLORS: Record<Position, string> = {
  SETTER: 'bg-purple-800/40 text-purple-300',
  OUTSIDE_HITTER: 'bg-blue-800/40 text-blue-300',
  OPPOSITE: 'bg-cyan-800/40 text-cyan-300',
  MIDDLE_BLOCKER: 'bg-emerald-800/40 text-emerald-300',
  LIBERO: 'bg-orange-800/40 text-orange-300',
  DEFENSIVE_SPECIALIST: 'bg-amber-800/40 text-amber-300',
};

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team, isLoading } = useTeam(teamId!);
  const createPlayer = useCreatePlayer();
  const deletePlayer = useDeletePlayer();
  const updatePlayer = useUpdatePlayer(teamId!);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    jerseyNumber: '',
    position: 'SETTER' as Position,
  });

  // Per-player edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    jerseyNumber: '',
    position: 'SETTER' as Position,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createPlayer.mutateAsync({
      ...form,
      jerseyNumber: Number(form.jerseyNumber),
      teamId: teamId!,
    });
    setForm({ firstName: '', lastName: '', jerseyNumber: '', position: 'SETTER' });
    setShowForm(false);
  }

  function startEdit(player: { id: string; firstName: string; lastName: string; jerseyNumber: number; position: Position }) {
    setEditingId(player.id);
    setEditForm({
      firstName: player.firstName,
      lastName: player.lastName,
      jerseyNumber: String(player.jerseyNumber),
      position: player.position,
    });
  }

  async function handleUpdate(e: React.FormEvent, id: string) {
    e.preventDefault();
    await updatePlayer.mutateAsync({
      id,
      data: {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        jerseyNumber: Number(editForm.jerseyNumber),
        position: editForm.position,
      },
    });
    setEditingId(null);
  }

  if (isLoading) return <p className="text-chalk-400">Loading…</p>;
  if (!team) return <p className="text-chalk-400">Team not found.</p>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-chalk-400">
        <Link to="/teams" className="hover:text-chalk-200">Teams</Link>
        <span>/</span>
        <span className="text-chalk-100">{team.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">{team.name}</h1>
          <p className="text-chalk-400 text-sm mt-0.5">{team.division} · Season {team.season}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/teams/${teamId}/dashboard`} className="btn-secondary text-sm">
            Dashboard
          </Link>
          <Link to={`/teams/${teamId}/matches`} className="btn-secondary text-sm">
            Matches
          </Link>
          <button className="btn-primary text-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {/* Add player form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-chalk-100 mb-4">Add Player</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-chalk-400 mb-1">First Name *</label>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Last Name *</label>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1"># Jersey *</label>
              <input
                className="input"
                type="number"
                min="0"
                max="99"
                value={form.jerseyNumber}
                onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Position *</label>
              <select
                className="input"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value as Position })}
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <button type="submit" className="btn-primary" disabled={createPlayer.isPending}>
                {createPlayer.isPending ? 'Adding…' : 'Add Player'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-court-800 flex items-center justify-between">
          <h2 className="font-semibold text-chalk-100">Roster</h2>
          <span className="text-xs text-chalk-400 font-mono">{team.players?.length ?? 0} players</span>
        </div>

        {!team.players?.length ? (
          <p className="text-chalk-400 text-sm p-5">No players yet.</p>
        ) : (
          <div className="divide-y divide-court-800">
            {team.players?.map((player) => (
              <div key={player.id}>
                {editingId === player.id ? (
                  /* ── Inline edit row ── */
                  <form
                    onSubmit={(e) => handleUpdate(e, player.id)}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 bg-court-800/40"
                  >
                    <div>
                      <label className="block text-xs text-chalk-400 mb-1">First Name</label>
                      <input
                        className="input text-sm"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-chalk-400 mb-1">Last Name</label>
                      <input
                        className="input text-sm"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-chalk-400 mb-1"># Jersey</label>
                      <input
                        className="input text-sm"
                        type="number"
                        min="0"
                        max="99"
                        value={editForm.jerseyNumber}
                        onChange={(e) => setEditForm({ ...editForm, jerseyNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-chalk-400 mb-1">Position</label>
                      <select
                        className="input text-sm"
                        value={editForm.position}
                        onChange={(e) => setEditForm({ ...editForm, position: e.target.value as Position })}
                      >
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-4 flex gap-2">
                      <button type="submit" className="btn-primary text-xs px-3 py-1.5" disabled={updatePlayer.isPending}>
                        {updatePlayer.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ── Normal row ── */
                  <div className="flex items-center gap-4 px-5 py-3">
                    <div className="w-9 h-9 bg-court-800 rounded-lg flex items-center justify-center font-mono font-bold text-spike-400 text-sm shrink-0">
                      {player.jerseyNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-chalk-100 truncate">
                        {player.firstName} {player.lastName}
                      </p>
                    </div>
                    <span className={`badge ${POSITION_COLORS[player.position]}`}>
                      {POSITION_LABELS[player.position]}
                    </span>
                    <button
                      className="text-chalk-600 hover:text-chalk-200 transition-colors text-xs"
                      onClick={() => startEdit(player)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-chalk-600 hover:text-red-400 transition-colors text-xs"
                      onClick={() => {
                        if (confirm(`Remove ${player.firstName} ${player.lastName}?`)) {
                          deletePlayer.mutate({ id: player.id, teamId: teamId! });
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
