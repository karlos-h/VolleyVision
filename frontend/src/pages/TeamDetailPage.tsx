import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTeam, useCreatePlayer, useDeletePlayer, useUpdatePlayer, useClaimTeam, useTransferOwnership, useTeamInvitations, useCreateInvitation } from '../hooks';
import type { Position, TeamRole, InvitationStatus, Invitation } from '../types';
import { POSITION_LABELS } from '../types';
import { useAuth } from '../context/AuthContext';
import TeamMembersCard from '../components/team/TeamMembersCard';
import PermissionGuard from '../components/ui/PermissionGuard';

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'HEAD_COACH',       label: 'Head Coach' },
  { value: 'ASSISTANT_COACH',  label: 'Assistant Coach' },
  { value: 'STATISTICIAN',     label: 'Statistician' },
  { value: 'PLAYER',           label: 'Player' },
  { value: 'VIEWER',           label: 'Viewer' },
];

const STATUS_COLORS: Record<InvitationStatus, string> = {
  PENDING:  'bg-amber-800/30 text-amber-300',
  ACCEPTED: 'bg-emerald-800/30 text-emerald-300',
  DECLINED: 'bg-red-900/30 text-red-400',
  EXPIRED:  'bg-court-700 text-chalk-500',
};

function TeamInvitationsCard({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const { data: invitations, isLoading } = useTeamInvitations(teamId);
  const createInv = useCreateInvitation(teamId);
  const [showForm, setShowForm] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<TeamRole>('PLAYER');
  const [invError, setInvError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setInvError('');
    try {
      await createInv.mutateAsync({ email: invEmail.trim(), role: invRole });
      setInvEmail('');
      setInvRole('PLAYER');
      setShowForm(false);
    } catch (err: any) {
      setInvError(err?.response?.data?.error ?? 'Failed to send invitation.');
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-court-800 flex items-center justify-between">
        <h2 className="font-semibold text-chalk-100">Invitations</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-chalk-400 font-mono">
            {invitations?.filter((i) => i.status === 'PENDING').length ?? 0} pending
          </span>
          {isOwner && (
            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Invite'}
            </button>
          )}
        </div>
      </div>

      {showForm && isOwner && (
        <form onSubmit={handleCreate} className="px-5 py-4 border-b border-court-800 bg-court-900/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-chalk-400 font-medium mb-1">Email address</label>
              <input
                className="input text-sm"
                type="email"
                placeholder="player@example.com"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-chalk-400 font-medium mb-1">Role</label>
              <select
                className="input text-sm"
                value={invRole}
                onChange={(e) => setInvRole(e.target.value as TeamRole)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          {invError && <p className="text-red-400 text-xs">{invError}</p>}
          <button type="submit" className="btn-primary text-sm" disabled={createInv.isPending}>
            {createInv.isPending ? 'Sending…' : 'Send Invitation'}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-chalk-400 text-sm p-5">Loading…</p>
      ) : !invitations?.length ? (
        <p className="text-chalk-500 text-sm p-5 italic">No invitations yet.</p>
      ) : (
        <div className="divide-y divide-court-800">
          {invitations.map((inv: Invitation) => (
            <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-chalk-100 text-sm font-medium truncate">{inv.email}</p>
                <p className="text-chalk-500 text-xs">
                  {ROLE_OPTIONS.find((r) => r.value === inv.role)?.label ?? inv.role}
                  {' · '}
                  {new Date(inv.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`badge text-xs ${STATUS_COLORS[inv.status]}`}>
                {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const { user } = useAuth();
  const createPlayer = useCreatePlayer();
  const deletePlayer = useDeletePlayer();
  const updatePlayer = useUpdatePlayer(teamId!);
  const claimTeam = useClaimTeam();
  const transferOwnership = useTransferOwnership();

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');

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
          <PermissionGuard teamId={teamId!} permission="MANAGE_TEAM">
            <button className="btn-primary text-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Add Player'}
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Ownership card */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-chalk-500 uppercase tracking-wide font-semibold mb-1">Owner</p>
            {team.owner ? (
              <p className="text-chalk-100 font-medium">
                {team.owner.firstName} {team.owner.lastName}
                <span className="text-chalk-500 font-normal ml-2 text-sm">{team.owner.email}</span>
              </p>
            ) : (
              <p className="text-chalk-500 italic text-sm">Unowned team</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            {/* Claim — only visible when unowned and user is logged in */}
            {!team.owner && user && (
              <button
                className="btn-primary text-sm"
                disabled={claimTeam.isPending}
                onClick={() => {
                  if (confirm(`Claim ownership of "${team.name}"?`)) {
                    claimTeam.mutate(team.id);
                  }
                }}
              >
                {claimTeam.isPending ? 'Claiming…' : 'Claim Team'}
              </button>
            )}

            {/* Transfer — only user with TRANSFER_OWNERSHIP permission */}
            <PermissionGuard teamId={teamId!} permission="TRANSFER_OWNERSHIP">
              {team.owner && (
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setShowTransfer(!showTransfer)}
                >
                  Transfer
                </button>
              )}
            </PermissionGuard>
          </div>
        </div>

        {/* Transfer form */}
        {showTransfer && team.owner && (
          <form
            className="mt-4 pt-4 border-t border-court-800 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!transferEmail.trim()) return;
              // Look up user by email via /api/v1/auth/me isn't suitable — we need
              // the new owner's userId. For now accept userId directly in the field.
              await transferOwnership.mutateAsync({ teamId: team.id, newOwnerId: transferEmail.trim() });
              setShowTransfer(false);
              setTransferEmail('');
            }}
          >
            <input
              className="input flex-1 text-sm"
              placeholder="New owner user ID"
              value={transferEmail}
              onChange={(e) => setTransferEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary text-sm" disabled={transferOwnership.isPending}>
              {transferOwnership.isPending ? 'Transferring…' : 'Confirm'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowTransfer(false)}>
              Cancel
            </button>
          </form>
        )}

        {claimTeam.isError && (
          <p className="mt-2 text-red-400 text-sm">
            {(claimTeam.error as any)?.response?.data?.error ?? 'Failed to claim team.'}
          </p>
        )}
        {transferOwnership.isError && (
          <p className="mt-2 text-red-400 text-sm">
            {(transferOwnership.error as any)?.response?.data?.error ?? 'Failed to transfer ownership.'}
          </p>
        )}
      </div>

      {/* Members */}
      <TeamMembersCard teamId={teamId!} ownerId={team.ownerId} />

      {/* Invitations */}
      <TeamInvitationsCard teamId={teamId!} isOwner={!!user && user.id === team.ownerId} />

      {/* Add player form */}
      {showForm && user && (
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
                    <PermissionGuard teamId={teamId!} permission="MANAGE_TEAM">
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
                    </PermissionGuard>
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
