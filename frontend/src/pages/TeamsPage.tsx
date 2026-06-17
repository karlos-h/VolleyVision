import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeams, useCreateTeam, useDeleteTeam, useUpdateTeam } from '../hooks';

export default function TeamsPage() {
  const { data: teams, isLoading } = useTeams();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const updateTeam = useUpdateTeam();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', division: '', season: '' });

  // Per-card edit state: teamId → edit form values
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', division: '', season: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.season) return;
    await createTeam.mutateAsync(form);
    setForm({ name: '', division: '', season: '' });
    setShowForm(false);
  }

  function startEdit(team: { id: string; name: string; division?: string; season: string }) {
    setEditingId(team.id);
    setEditForm({ name: team.name, division: team.division ?? '', season: team.season });
  }

  async function handleUpdate(e: React.FormEvent, id: string) {
    e.preventDefault();
    await updateTeam.mutateAsync({ id, data: editForm });
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">Teams</h1>
          <p className="text-chalk-400 text-sm mt-0.5">Manage your rosters and schedules</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Team'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-chalk-100 mb-4">New Team</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Team Name *</label>
              <input
                className="input"
                placeholder="e.g. Canterbury Falcons"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Division</label>
              <input
                className="input"
                placeholder="e.g. National League Div 1"
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 mb-1">Season *</label>
              <input
                className="input"
                placeholder="e.g. 2025/26"
                value={form.season}
                onChange={(e) => setForm({ ...form, season: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button type="submit" className="btn-primary" disabled={createTeam.isPending}>
                {createTeam.isPending ? 'Creating…' : 'Create Team'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teams list */}
      {isLoading ? (
        <p className="text-chalk-400 text-sm">Loading teams…</p>
      ) : teams?.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-chalk-400">No teams yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams?.map((team) => (
            <div key={team.id} className="card p-5 flex flex-col gap-4">
              {editingId === team.id ? (
                /* ── Inline edit form ── */
                <form onSubmit={(e) => handleUpdate(e, team.id)} className="space-y-3">
                  <div>
                    <label className="block text-xs text-chalk-400 mb-1">Team Name *</label>
                    <input
                      className="input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-chalk-400 mb-1">Division</label>
                    <input
                      className="input"
                      value={editForm.division}
                      onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-chalk-400 mb-1">Season *</label>
                    <input
                      className="input"
                      value={editForm.season}
                      onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary text-sm" disabled={updateTeam.isPending}>
                      {updateTeam.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                /* ── Normal card view ── */
                <>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-chalk-100 leading-tight">{team.name}</h2>
                      <div className="flex gap-2 shrink-0 mt-0.5">
                        <button
                          className="text-chalk-600 hover:text-chalk-200 transition-colors text-xs"
                          onClick={() => startEdit(team)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-chalk-600 hover:text-red-400 transition-colors text-xs"
                          onClick={() => {
                            if (confirm(`Delete "${team.name}"? This cannot be undone.`)) {
                              deleteTeam.mutate(team.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-chalk-400 text-xs mt-1">{team.division || '—'}</p>
                    <p className="text-chalk-600 text-xs">Season {team.season}</p>
                  </div>

                  <div className="flex gap-3 text-center">
                    <div className="flex-1 bg-court-800 rounded-xl py-2">
                      <div className="font-mono font-bold text-spike-400">
                        {team._count?.players ?? 0}
                      </div>
                      <div className="text-xs text-chalk-400">Players</div>
                    </div>
                    <div className="flex-1 bg-court-800 rounded-xl py-2">
                      <div className="font-mono font-bold text-chalk-200">
                        {team._count?.matches ?? 0}
                      </div>
                      <div className="text-xs text-chalk-400">Matches</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/teams/${team.id}`} className="btn-secondary flex-1 text-center text-sm py-2">
                      Roster
                    </Link>
                    <Link to={`/teams/${team.id}/matches`} className="btn-secondary flex-1 text-center text-sm py-2">
                      Matches
                    </Link>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
