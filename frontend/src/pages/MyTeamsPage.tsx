import { Link } from 'react-router-dom';
import { useMyTeams } from '../hooks';
import { useAuth } from '../context/AuthContext';

export default function MyTeamsPage() {
  const { user } = useAuth();
  const { data: teams, isLoading, isError } = useMyTeams();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-chalk-100">My Teams</h1>
        <p className="text-chalk-400 text-sm mt-0.5">
          Teams you own as {user?.firstName} {user?.lastName}
        </p>
      </div>

      {isLoading ? (
        <p className="text-chalk-400 text-sm">Loading your teams…</p>
      ) : isError ? (
        <div className="card p-8 text-center">
          <p className="text-red-400 text-sm">Failed to load teams. Please try again.</p>
        </div>
      ) : !teams?.length ? (
        /* ── Empty state ── */
        <div className="card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-court-800 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-chalk-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-chalk-300 font-medium">You don't own any teams yet</p>
            <p className="text-chalk-500 text-sm mt-1">
              Browse all teams and claim one to get started.
            </p>
          </div>
          <Link to="/teams" className="btn-primary inline-block">
            Browse Teams
          </Link>
        </div>
      ) : (
        /* ── Teams grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="card p-5 flex flex-col gap-4">
              <div>
                <h2 className="font-bold text-chalk-100 text-lg leading-tight">{team.name}</h2>
                <p className="text-chalk-400 text-xs mt-0.5">{team.division || '—'}</p>
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
                <Link to={`/teams/${team.id}/dashboard`} className="btn-secondary flex-1 text-center text-sm py-2">
                  Dashboard
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
