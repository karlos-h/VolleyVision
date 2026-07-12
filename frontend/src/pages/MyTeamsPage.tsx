import { Link } from 'react-router-dom';
import { useMyTeams, useMyMemberships, useMyInvitations } from '../hooks';
import { useAuth } from '../context/AuthContext';
import type { TeamRole } from '../types';

const ROLE_LABELS: Record<TeamRole, string> = {
  HEAD_COACH:      'Head Coach',
  ASSISTANT_COACH: 'Assistant Coach',
  STATISTICIAN:    'Statistician',
  PLAYER:          'Player',
  VIEWER:          'Viewer',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  HEAD_COACH:      'bg-spike-600/20 text-spike-400',
  ASSISTANT_COACH: 'bg-info/30 text-info',
  STATISTICIAN:    'bg-purple-800/30 text-purple-300',
  PLAYER:          'bg-success/30 text-success-dark',
  VIEWER:          'bg-court-700 text-chalk-400',
};

function TeamCard({ id, name, division, season, players, matches, badge, mode }: {
  id: string; name: string; division?: string; season: string;
  players?: number; matches?: number;
  badge?: { label: string; color: string };
  mode: 'coach' | 'player';
}) {
  const isPlayerOnly = mode === 'player';

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold text-chalk-100 text-lg leading-tight">{name}</h2>
          {badge && (
            <span className={`badge text-xs shrink-0 mt-0.5 ${badge.color}`}>{badge.label}</span>
          )}
        </div>
        <p className="text-chalk-400 text-xs mt-0.5">{division || '—'}</p>
        <p className="text-chalk-600 text-xs">Season {season}</p>
      </div>
      <div className="flex gap-3 text-center">
        <div className="flex-1 bg-court-800 rounded-xl py-2">
          <div className="font-mono font-bold text-spike-400">{players ?? 0}</div>
          <div className="text-xs text-chalk-400">Players</div>
        </div>
        <div className="flex-1 bg-court-800 rounded-xl py-2">
          <div className="font-mono font-bold text-chalk-200">{matches ?? 0}</div>
          <div className="text-xs text-chalk-400">Matches</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {isPlayerOnly ? (
          // Players get a direct portal link as primary action, plus roster/matches as secondary
          <>
            <Link to="/player" className="btn-secondary flex-1 text-center text-sm py-2">My portal</Link>
            <Link to={`/teams/${id}/matches`} className="btn-secondary flex-1 text-center text-sm py-2">Matches</Link>
          </>
        ) : (
          <>
            <Link to={`/teams/${id}`} className="btn-secondary flex-1 text-center text-sm py-2">Roster</Link>
            <Link to={`/teams/${id}/matches`} className="btn-secondary flex-1 text-center text-sm py-2">Matches</Link>
            <Link to={`/teams/${id}/dashboard`} className="btn-secondary flex-1 text-center text-sm py-2">Dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
}

const COACH_ROLES: TeamRole[] = ['HEAD_COACH', 'ASSISTANT_COACH', 'STATISTICIAN'];

export default function MyTeamsPage() {
  const { user } = useAuth();
  const { data: ownedTeams, isLoading: loadingOwned } = useMyTeams();
  const { data: memberships, isLoading: loadingMember } = useMyMemberships();
  const { data: invitations } = useMyInvitations();
  const pendingCount = invitations?.length ?? 0;

  const ownedIds = new Set(ownedTeams?.map((t) => t.id) ?? []);

  // "Teams I Coach": teams I own, plus memberships with a coaching role.
  const coachMemberships =
    memberships?.filter((m) => COACH_ROLES.includes(m.role) && !ownedIds.has(m.team.id)) ?? [];

  // "Teams I Play On": memberships where my role on that team is PLAYER.
  const playingMemberships = memberships?.filter((m) => m.role === 'PLAYER') ?? [];

  const isLoading = loadingOwned || loadingMember;
  const hasNothing = !ownedTeams?.length && !coachMemberships.length && !playingMemberships.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">My teams</h1>
          <p className="text-chalk-400 text-sm mt-0.5">
            Teams you own or belong to, {user?.firstName} {user?.lastName}
          </p>
        </div>
        <Link
          to="/invitations"
          className="btn-secondary text-sm flex items-center gap-2 shrink-0"
        >
          Invitations
          {pendingCount > 0 && (
            <span className="bg-spike-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      {isLoading ? (
        <p className="text-chalk-400 text-sm">Loading your teams…</p>
      ) : hasNothing ? (
        <div className="card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-court-800 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-chalk-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-chalk-300 font-medium">You're not part of any team yet</p>
            <p className="text-chalk-500 text-sm mt-1">Claim an existing team or ask a coach to add you.</p>
          </div>
          <Link to="/teams" className="btn-primary inline-block">Browse teams</Link>
        </div>
      ) : (
        <>
          {/* ── Teams I Coach ── */}
          {(!!ownedTeams?.length || !!coachMemberships.length) && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-chalk-400">Teams I Coach</h2>
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
                    badge={{ label: 'Owner', color: 'bg-spike-600/20 text-spike-400' }}
                    mode="coach"
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
                    badge={{ label: ROLE_LABELS[m.role], color: ROLE_COLORS[m.role] }}
                    mode="coach"
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Teams I Play On ── */}
          {!!playingMemberships.length && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-chalk-400">Teams I Play On</h2>
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
                    badge={{ label: ROLE_LABELS[m.role], color: ROLE_COLORS[m.role] }}
                    mode="player"
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
