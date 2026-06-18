import { Link } from 'react-router-dom';
import { useCoachDashboard, useMyInvitations } from '../hooks';
import { useAuth } from '../context/AuthContext';
import type { TeamSummary, MatchSummaryItem } from '../types';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-chalk-400">{label}</p>
      <p className="font-mono text-2xl font-bold text-chalk-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-chalk-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function TeamCard({ team }: { team: TeamSummary }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-chalk-100 text-sm leading-tight">{team.name}</p>
          {team.memberRole && (
            <span className="badge bg-blue-800/30 text-blue-300 text-xs shrink-0">{team.memberRole.replace(/_/g, ' ')}</span>
          )}
        </div>
        <p className="text-chalk-500 text-xs mt-0.5">{team.division || '—'} · Season {team.season}</p>
      </div>
      <div className="flex gap-2 text-center">
        <div className="flex-1 bg-court-800 rounded-lg py-1.5">
          <div className="font-mono font-bold text-spike-400 text-sm">{team._count.players}</div>
          <div className="text-xs text-chalk-500">Players</div>
        </div>
        <div className="flex-1 bg-court-800 rounded-lg py-1.5">
          <div className="font-mono font-bold text-chalk-200 text-sm">{team._count.matches}</div>
          <div className="text-xs text-chalk-500">Matches</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Link to={`/teams/${team.id}`} className="btn-secondary flex-1 text-center text-xs py-1.5">Roster</Link>
        <Link to={`/teams/${team.id}/dashboard`} className="btn-secondary flex-1 text-center text-xs py-1.5">Dashboard</Link>
        <Link to={`/teams/${team.id}/matches`} className="btn-secondary flex-1 text-center text-xs py-1.5">Matches</Link>
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: MatchSummaryItem }) {
  const won = match.homeSetsWon > match.awaySetsWon;
  const isCompleted = match.status === 'COMPLETED';
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-chalk-100 text-sm font-medium truncate">vs {match.opponent}</p>
        <p className="text-chalk-500 text-xs">
          {match.team.name} · {new Date(match.matchDate).toLocaleDateString()}
        </p>
      </div>
      {isCompleted ? (
        <span className={`badge text-xs ${won ? 'bg-emerald-800/30 text-emerald-300' : 'bg-red-900/30 text-red-400'}`}>
          {match.homeSetsWon}–{match.awaySetsWon} {won ? 'W' : 'L'}
        </span>
      ) : (
        <span className="badge bg-amber-800/30 text-amber-300 text-xs">
          {match.status.replace('_', ' ')}
        </span>
      )}
      <Link to={`/matches/${match.id}/dashboard`} className="text-chalk-600 hover:text-chalk-200 text-xs transition-colors">
        View →
      </Link>
    </div>
  );
}

export default function CoachDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useCoachDashboard();
  const { data: invitations } = useMyInvitations();
  const pendingInvitations = invitations?.length ?? 0;

  if (isLoading) return <p className="text-chalk-400">Loading dashboard…</p>;
  if (!data) return <p className="text-red-400">Unable to load coach dashboard.</p>;

  const { ownedTeams, memberTeams, coachingStats, recentMatches } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-chalk-400 text-sm mt-0.5">Coach Dashboard</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/profile" className="btn-secondary text-sm">Profile</Link>
          {pendingInvitations > 0 && (
            <Link to="/invitations" className="btn-primary text-sm flex items-center gap-2">
              Invitations
              <span className="bg-white/20 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingInvitations}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Coaching stats */}
      <section>
        <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide mb-3">Career Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Teams Owned" value={coachingStats.teamsOwned} />
          <StatCard label="Teams Coached" value={coachingStats.teamsCoached} />
          <StatCard label="Matches" value={coachingStats.totalMatches} />
          <StatCard label="Wins" value={coachingStats.wins} />
          <StatCard label="Losses" value={coachingStats.losses} />
          <StatCard
            label="Win Rate"
            value={coachingStats.winPercentage !== null ? `${coachingStats.winPercentage}%` : '—'}
          />
        </div>
      </section>

      {/* Owned teams */}
      {ownedTeams.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">My Teams</h2>
            <Link to="/my-teams" className="text-xs text-chalk-500 hover:text-chalk-200 transition-colors">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ownedTeams.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}

      {/* Member teams */}
      {memberTeams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">Member Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memberTeams.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!ownedTeams.length && !memberTeams.length && (
        <div className="card p-12 text-center space-y-4">
          <p className="text-chalk-300 font-medium">No teams yet</p>
          <p className="text-chalk-500 text-sm">Claim or create a team to get started.</p>
          <Link to="/teams" className="btn-primary inline-block">Browse Teams</Link>
        </div>
      )}

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide mb-3">Recent Matches</h2>
          <div className="card overflow-hidden divide-y divide-court-800">
            {recentMatches.map((match) => <MatchRow key={match.id} match={match} />)}
          </div>
        </section>
      )}
    </div>
  );
}
