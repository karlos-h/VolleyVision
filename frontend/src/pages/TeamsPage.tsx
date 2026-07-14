import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useMyTeams, useMyMemberships, useMyInvitations,
  useCreateTeam, useUpdateTeam, useDeleteTeam,
} from '../hooks';
import { useAuth } from '../context/AuthContext';
import PermissionGuard from '../components/ui/PermissionGuard';
import { PencilIcon, TrashIcon } from '../components/ui/icons';
import type { TeamRole } from '../types';

const ROLE_LABELS: Record<TeamRole, string> = {
  HEAD_COACH:      'Head Coach',
  ASSISTANT_COACH: 'Assistant Coach',
  STATISTICIAN:    'Statistician',
  PLAYER:          'Player',
  VIEWER:          'Viewer',
};

const ROLE_BADGE: Record<TeamRole, string> = {
  HEAD_COACH:      'badge-accent',
  ASSISTANT_COACH: 'badge-info',
  STATISTICIAN:    'badge-brand',
  PLAYER:          'badge-success',
  VIEWER:          'badge-neutral',
};

interface TeamCardProps {
  id: string;
  name: string;
  division?: string;
  season: string;
  players?: number;
  matches?: number;
  badge?: { label: string; className: string };
  mode: 'coach' | 'player';
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  editSlot?: React.ReactNode;
}

function TeamCard({
  id, name, division, season, players, matches, badge, mode,
  onEdit, onDelete, isEditing, editSlot,
}: TeamCardProps) {
  if (isEditing) return <div className="card p-5">{editSlot}</div>;

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold text-grey-900 text-lg leading-tight min-w-0 truncate">{name}</h2>
          {badge && (
            <span className={`badge ${badge.className} shrink-0 mt-0.5`}>{badge.label}</span>
          )}
        </div>
        <p className="text-grey-600 text-xs mt-0.5">{division || '—'}</p>
        <p className="text-grey-400 text-xs">Season {season}</p>
      </div>

      <div className="flex gap-3 text-center">
        <div className="flex-1 bg-grey-50 border border-grey-200 rounded-xl py-2">
          <div className="font-bold tabular-nums text-navy-700">{players ?? 0}</div>
          <div className="text-xs text-grey-600">Players</div>
        </div>
        <div className="flex-1 bg-grey-50 border border-grey-200 rounded-xl py-2">
          <div className="font-bold tabular-nums text-grey-900">{matches ?? 0}</div>
          <div className="text-xs text-grey-600">Matches</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {mode === 'player' ? (
          <>
            <Link to="/dashboard" className="btn-secondary flex-1 text-center text-sm py-2">My portal</Link>
            <Link to={`/teams/${id}/matches`} className="btn-secondary flex-1 text-center text-sm py-2">Matches</Link>
          </>
        ) : (
          <>
            <Link to={`/teams/${id}`} className="btn-secondary flex-1 text-center text-sm py-2">Roster</Link>
            <Link to={`/teams/${id}/matches`} className="btn-secondary flex-1 text-center text-sm py-2">Matches</Link>
            <PermissionGuard teamId={id} permission="MANAGE_TEAM">
              <button className="btn-icon" onClick={onEdit} aria-label={`Edit ${name}`} title="Edit team">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button className="btn-icon-danger" onClick={onDelete} aria-label={`Delete ${name}`} title="Delete team">
                <TrashIcon className="w-4 h-4" />
              </button>
            </PermissionGuard>
          </>
        )}
      </div>
    </div>
  );
}

const COACH_ROLES: TeamRole[] = ['HEAD_COACH', 'ASSISTANT_COACH', 'STATISTICIAN'];

/**
 * The single Teams page. Teams are private to their members, so "browse all
 * teams" no longer exists — this shows exactly the teams you own or belong to,
 * grouped by what you do on them, with create/edit/delete for teams you manage.
 */
export default function TeamsPage() {
  const { user } = useAuth();
  const { data: ownedTeams, isLoading: loadingOwned } = useMyTeams();
  const { data: memberships, isLoading: loadingMember } = useMyMemberships();
  const { data: invitations } = useMyInvitations();

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const pendingCount = invitations?.length ?? 0;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', division: '', season: '' });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', division: '', season: '' });

  const ownedIds = new Set(ownedTeams?.map((t) => t.id) ?? []);
  const coachMemberships =
    memberships?.filter((m) => COACH_ROLES.includes(m.role) && !ownedIds.has(m.team.id)) ?? [];
  const playingMemberships = memberships?.filter((m) => m.role === 'PLAYER') ?? [];

  const isLoading = loadingOwned || loadingMember;
  const hasNothing = !ownedTeams?.length && !coachMemberships.length && !playingMemberships.length;

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

  function confirmDelete(id: string, name: string) {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) deleteTeam.mutate(id);
  }

  const editSlot = (id: string) => (
    <form onSubmit={(e) => handleUpdate(e, id)} className="space-y-3">
      <div>
        <label className="block text-xs text-grey-600 mb-1">Team Name *</label>
        <input
          className="input"
          value={editForm.name}
          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-grey-600 mb-1">Division</label>
        <input
          className="input"
          value={editForm.division}
          onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs text-grey-600 mb-1">Season *</label>
        <input
          className="input"
          value={editForm.season}
          onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
          required
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary text-sm" disabled={updateTeam.isPending}>
          {updateTeam.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setEditingId(null)}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-grey-600 text-sm">
          Teams you own or belong to, {user?.firstName} {user?.lastName}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/invitations" className="btn-secondary text-sm flex items-center gap-2">
            Invitations
            {pendingCount > 0 && (
              <span className="bg-gold-500 text-navy-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Link>
          <button className={showForm ? 'btn-secondary' : 'btn-primary'} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New team'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-grey-900 mb-4">New Team</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-grey-600 mb-1">Team Name *</label>
              <input
                className="input"
                placeholder="e.g. Canterbury Falcons"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-grey-600 mb-1">Division</label>
              <input
                className="input"
                placeholder="e.g. National League Div 1"
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-grey-600 mb-1">Season *</label>
              <input
                className="input"
                placeholder="e.g. 2025/26"
                value={form.season}
                onChange={(e) => setForm({ ...form, season: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary" disabled={createTeam.isPending}>
                {createTeam.isPending ? 'Creating…' : 'Create team'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <p className="text-grey-600 text-sm">Loading your teams…</p>
      ) : hasNothing ? (
        <div className="card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-grey-50 border border-grey-200 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-grey-900 font-medium">You're not part of any team yet</p>
            <p className="text-grey-600 text-sm mt-1">
              Create one, or ask a coach to send you an invitation.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Create a team</button>
        </div>
      ) : (
        <>
          {/* ── Teams I Coach ── */}
          {(!!ownedTeams?.length || !!coachMemberships.length) && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-grey-600">Teams I Coach</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedTeams?.map((team) => (
                  <TeamCard
                    key={team.id}
                    id={team.id}
                    name={team.name}
                    division={team.division}
                    season={team.season}
                    players={team._count?.players}
                    matches={team._count?.matches}
                    badge={{ label: 'Owner', className: 'badge-accent' }}
                    mode="coach"
                    isEditing={editingId === team.id}
                    editSlot={editSlot(team.id)}
                    onEdit={() => startEdit(team)}
                    onDelete={() => confirmDelete(team.id, team.name)}
                  />
                ))}
                {coachMemberships.map((m) => (
                  <TeamCard
                    key={m.id}
                    id={m.team.id}
                    name={m.team.name}
                    division={m.team.division}
                    season={m.team.season}
                    players={m.team._count?.players}
                    matches={m.team._count?.matches}
                    badge={{ label: ROLE_LABELS[m.role], className: ROLE_BADGE[m.role] }}
                    mode="coach"
                    isEditing={editingId === m.team.id}
                    editSlot={editSlot(m.team.id)}
                    onEdit={() => startEdit(m.team)}
                    onDelete={() => confirmDelete(m.team.id, m.team.name)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Teams I Play On ── */}
          {!!playingMemberships.length && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-grey-600">Teams I Play On</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playingMemberships.map((m) => (
                  <TeamCard
                    key={m.id}
                    id={m.team.id}
                    name={m.team.name}
                    division={m.team.division}
                    season={m.team.season}
                    players={m.team._count?.players}
                    matches={m.team._count?.matches}
                    badge={{ label: ROLE_LABELS[m.role], className: ROLE_BADGE[m.role] }}
                    mode="player"
                    isEditing={false}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
