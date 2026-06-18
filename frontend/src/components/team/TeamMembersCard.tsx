import { useState } from 'react';
import { useTeamMembers, useAddMember, useUpdateMemberRole, useRemoveMember, useUserSearch } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import type { TeamRole } from '../../types';

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'HEAD_COACH',       label: 'Head Coach' },
  { value: 'ASSISTANT_COACH',  label: 'Assistant Coach' },
  { value: 'STATISTICIAN',     label: 'Statistician' },
  { value: 'PLAYER',           label: 'Player' },
  { value: 'VIEWER',           label: 'Viewer' },
];

const ROLE_COLORS: Record<TeamRole, string> = {
  HEAD_COACH:      'bg-spike-600/20 text-spike-400',
  ASSISTANT_COACH: 'bg-blue-800/30 text-blue-300',
  STATISTICIAN:    'bg-purple-800/30 text-purple-300',
  PLAYER:          'bg-emerald-800/30 text-emerald-300',
  VIEWER:          'bg-court-700 text-chalk-400',
};

interface Props {
  teamId: string;
  ownerId?: string | null;
}

export default function TeamMembersCard({ teamId, ownerId }: Props) {
  const { user } = useAuth();
  const { data: members, isLoading } = useTeamMembers(teamId);
  const addMember       = useAddMember(teamId);
  const updateRole      = useUpdateMemberRole(teamId);
  const removeMember    = useRemoveMember(teamId);

  const isOwner = !!user && user.id === ownerId;

  // Add-member panel state
  const [showAdd, setShowAdd]     = useState(false);
  const [searchQ, setSearchQ]     = useState('');
  const [addRole, setAddRole]     = useState<TeamRole>('PLAYER');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addError, setAddError]   = useState('');

  const { data: searchResults } = useUserSearch(searchQ);

  async function handleAdd() {
    setAddError('');
    if (!selectedUserId) { setAddError('Select a user first.'); return; }
    try {
      await addMember.mutateAsync({ userId: selectedUserId, role: addRole });
      setShowAdd(false);
      setSearchQ('');
      setSelectedUserId('');
    } catch (err: any) {
      setAddError(err?.response?.data?.error ?? 'Failed to add member.');
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-court-800 flex items-center justify-between">
        <h2 className="font-semibold text-chalk-100">Team Members</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-chalk-400 font-mono">{members?.length ?? 0} members</span>
          {isOwner && (
            <button
              className="btn-primary text-xs px-3 py-1.5"
              onClick={() => setShowAdd(!showAdd)}
            >
              {showAdd ? 'Cancel' : '+ Add Member'}
            </button>
          )}
        </div>
      </div>

      {/* Add member panel */}
      {showAdd && isOwner && (
        <div className="px-5 py-4 border-b border-court-800 bg-court-900/50 space-y-3">
          <div className="space-y-2">
            <label className="block text-xs text-chalk-400 font-medium">Search user</label>
            <input
              className="input text-sm"
              placeholder="Name or email…"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setSelectedUserId(''); }}
            />
            {searchResults && searchResults.length > 0 && !selectedUserId && (
              <div className="bg-court-800 border border-court-700 rounded-xl overflow-hidden">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-court-700 transition-colors border-b border-court-700 last:border-0"
                    onClick={() => { setSelectedUserId(u.id); setSearchQ(`${u.firstName} ${u.lastName} — ${u.email}`); }}
                  >
                    <span className="text-chalk-100 text-sm font-medium">{u.firstName} {u.lastName}</span>
                    <span className="text-chalk-500 text-xs ml-2">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
            {searchQ.trim().length >= 2 && searchResults?.length === 0 && !selectedUserId && (
              <p className="text-chalk-500 text-xs px-1">No users found.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-chalk-400 font-medium">Role</label>
            <select
              className="input text-sm"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as TeamRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {addError && <p className="text-red-400 text-xs">{addError}</p>}

          <button
            className="btn-primary text-sm"
            onClick={handleAdd}
            disabled={addMember.isPending || !selectedUserId}
          >
            {addMember.isPending ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      )}

      {/* Members list */}
      {isLoading ? (
        <p className="text-chalk-400 text-sm p-5">Loading members…</p>
      ) : !members?.length ? (
        <p className="text-chalk-500 text-sm p-5 italic">No members yet.</p>
      ) : (
        <div className="divide-y divide-court-800">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              canManage={isOwner}
              onRoleChange={(role) => updateRole.mutate({ memberId: m.id, role })}
              onRemove={() => {
                if (confirm(`Remove ${m.user.firstName} ${m.user.lastName} from the team?`)) {
                  removeMember.mutate(m.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MemberRowProps {
  member: {
    id: string;
    role: TeamRole;
    user: { id: string; firstName: string; lastName: string; email: string };
  };
  canManage: boolean;
  onRoleChange: (role: TeamRole) => void;
  onRemove: () => void;
}

function MemberRow({ member, canManage, onRoleChange, onRemove }: MemberRowProps) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<TeamRole>(member.role);

  function saveRole() {
    onRoleChange(role);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3">
      {/* Avatar initials */}
      <div className="w-9 h-9 rounded-full bg-court-700 flex items-center justify-center font-bold text-sm text-chalk-300 shrink-0">
        {member.user.firstName[0]}{member.user.lastName[0]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-chalk-100 truncate">
          {member.user.firstName} {member.user.lastName}
        </p>
        <p className="text-chalk-500 text-xs truncate">{member.user.email}</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <select
            className="input text-xs py-1 px-2"
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button className="btn-primary text-xs px-2 py-1" onClick={saveRole}>Save</button>
          <button className="btn-secondary text-xs px-2 py-1" onClick={() => { setEditing(false); setRole(member.role); }}>✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${ROLE_COLORS[member.role]} text-xs`}>
            {ROLE_OPTIONS.find((r) => r.value === member.role)?.label ?? member.role}
          </span>
          {canManage && (
            <>
              <button
                className="text-chalk-600 hover:text-chalk-200 transition-colors text-xs"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className="text-chalk-600 hover:text-red-400 transition-colors text-xs"
                onClick={onRemove}
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
