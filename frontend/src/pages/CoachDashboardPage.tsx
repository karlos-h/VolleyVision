import { Link } from 'react-router-dom';
import { useCoachDashboard, useMyInvitations } from '../hooks';
import { useAuth } from '../context/AuthContext';
import type { TeamSummary, MatchSummaryItem } from '../types';
import UpcomingGamesCard from '../components/ui/UpcomingGamesCard';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-navy-300">{label}</p>
      <p className="tabular-nums text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-navy-300 mt-0.5">{sub}</p>}
    </div>
  );
}

function TeamCard({ team }: { team: TeamSummary }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-white text-sm leading-tight">{team.name}</p>
          {team.memberRole && (
            <span className="badge bg-info/30 text-info text-xs shrink-0">{team.memberRole.replace(/_/g, ' ')}</span>
          )}
        </div>
        <p className="text-navy-300 text-xs mt-0.5">{team.division || '—'} · Season {team.season}</p>
      </div>
      <div className="flex gap-2 text-center">
        <div className="flex-1 bg-navy-700 rounded-lg py-1.5">
          <div className="tabular-nums font-bold text-gold-500 text-sm">{team._count.players}</div>
          <div className="text-xs text-navy-300">Players</div>
        </div>
        <div className="flex-1 bg-navy-700 rounded-lg py-1.5">
          <div className="tabular-nums font-bold text-navy-100 text-sm">{team._count.matches}</div>
          <div className="text-xs text-navy-300">Matches</div>
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
        <p className="text-white text-sm font-medium truncate">vs {match.opponent}</p>
        <p className="text-navy-300 text-xs">
          {match.team.name} · {new Date(match.matchDate).toLocaleDateString()}
        </p>
      </div>
      {isCompleted ? (
        <span className={`badge text-sm ${won ? 'bg-success/30 text-success-dark' : 'bg-error/30 text-error-dark'}`}>
          {match.homeSetsWon}–{match.awaySetsWon} {won ? 'W' : 'L'}
        </span>
      ) : (
        <span className="badge bg-gold-500/30 text-gold-500 text-xs">
          {match.status.replace('_', ' ')}
        </span>
      )}
      <Link to={`/matches/${match.id}/dashboard`} className="text-grey-600 hover:text-navy-100 text-xs transition-colors">
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

  if (isLoading) return <p className="text-navy-300">Loading dashboard…</p>;
  if (!data) return <p className="text-error-dark">Couldn't load coach dashboard.</p>;

  const { ownedTeams, memberTeams, coachingStats, recentMatches, upcomingMatches } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-navy-300 text-sm mt-0.5">Coach dashboard</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/profile" className="btn-secondary text-sm">Profile</Link>
          {pendingInvitations > 0 && (
            <Link to="/invitations" className="btn-secondary text-sm flex items-center gap-2">
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
        <h2 className="text-sm font-semibold text-navy-300 mb-3">Career overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Teams owned" value={coachingStats.teamsOwned} />
          <StatCard label="Teams coached" value={coachingStats.teamsCoached} />
          <StatCard label="Matches" value={coachingStats.totalMatches} />
          <StatCard label="Wins" value={coachingStats.wins} />
          <StatCard label="Losses" value={coachingStats.losses} />
          <StatCard
            label="Win rate"
            value={coachingStats.winPercentage !== null ? `${coachingStats.winPercentage}%` : '—'}
          />
        </div>
      </section>

      {/* Owned teams */}
      {ownedTeams.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy-300">My teams</h2>
            <Link to="/my-teams" className="text-xs text-navy-300 hover:text-navy-100 transition-colors">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ownedTeams.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}

      {/* Member teams */}
      {memberTeams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-navy-300">Member teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memberTeams.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!ownedTeams.length && !memberTeams.length && (
        <div className="card p-12 text-center space-y-4">
          <p className="text-navy-100 font-medium">No teams yet</p>
          <p className="text-navy-300 text-sm">Claim or create a team to unlock your coaching dashboard.</p>
          <Link to="/teams" className="btn-primary inline-block">Browse teams</Link>
        </div>
      )}

      {/* Upcoming games */}
      {(upcomingMatches ?? []).length > 0 && (
        <section>
          <UpcomingGamesCard matches={upcomingMatches} />
        </section>
      )}

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-navy-300 mb-3">Recent matches</h2>
          <div className="card overflow-hidden divide-y divide-navy-700">
            {recentMatches.map((match) => <MatchRow key={match.id} match={match} />)}
          </div>
        </section>
      )}
    </div>
  );
}
