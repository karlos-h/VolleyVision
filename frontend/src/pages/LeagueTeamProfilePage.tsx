import { useParams, Link } from 'react-router-dom';
import { useLeagueTeamProfile } from '../hooks';

// ─── Win/loss trend indicator ─────────────────────────────────────────────────

function TrendBar({ trend }: { trend: ('W' | 'L')[] }) {
  if (!trend.length) return <span className="text-chalk-600 text-xs">No results yet</span>;
  return (
    <div className="flex gap-1">
      {trend.map((r, i) => (
        <span
          key={i}
          className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center
            ${r === 'W' ? 'bg-success/40 text-success' : 'bg-error/30 text-error'}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LeagueTeamProfilePage() {
  const { leagueTeamId } = useParams<{ leagueTeamId: string }>();
  const { data: profile, isLoading, error } = useLeagueTeamProfile(leagueTeamId!);

  if (isLoading) return <p className="text-chalk-400 text-sm">Loading team profile…</p>;
  if (error || !profile) return <p className="text-error text-sm">Team profile not found.</p>;

  const { standing, recentResults, winLossTrend, upcomingFixtures, privateIntel } = profile;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="text-xs text-chalk-500 flex gap-1 items-center">
        <Link to="/leagues" className="hover:text-chalk-300">League Hub</Link>
        <span>/</span>
        <span className="text-chalk-300">{profile.teamName}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-chalk-100">{profile.teamName}</h1>
        <p className="text-chalk-400 text-sm mt-0.5">
          {profile.division ?? 'No division'} · Season {profile.season}
        </p>
      </div>

      {/* Standing row */}
      {standing && (
        <section className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="font-mono font-bold text-2xl text-navy-700">{standing.points}</div>
            <div className="text-xs text-chalk-400 mt-0.5">Points</div>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-success">{standing.wins}</div>
            <div className="text-xs text-chalk-400 mt-0.5">Wins</div>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl text-chalk-300">{standing.losses}</div>
            <div className="text-xs text-chalk-400 mt-0.5">Losses</div>
          </div>
          <div>
            <div className={`font-mono font-bold text-2xl ${standing.setDifferential >= 0 ? 'text-success' : 'text-error'}`}>
              {standing.setDifferential >= 0 ? `+${standing.setDifferential}` : standing.setDifferential}
            </div>
            <div className="text-xs text-chalk-400 mt-0.5">Set diff</div>
          </div>
        </section>
      )}

      {/* Win/loss trend */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-chalk-400">Form</h2>
        <TrendBar trend={winLossTrend} />
        {winLossTrend.length > 0 && (
          <p className="text-xs text-chalk-600">Oldest → newest</p>
        )}
      </section>

      {/* Recent results */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-chalk-400">Recent results</h2>
        {recentResults.length === 0 ? (
          <p className="text-chalk-500 text-sm">No completed results yet.</p>
        ) : (
          <div className="space-y-2">
            {recentResults.map((r) => (
              <div key={r.fixtureId} className="card p-3 flex items-center gap-3 text-sm">
                <span className={`w-7 h-7 rounded font-bold text-xs flex items-center justify-center shrink-0
                  ${r.result === 'W' ? 'bg-success/40 text-success' : 'bg-error/30 text-error'}`}>
                  {r.result}
                </span>
                <span className="text-chalk-300 flex-1">
                  {r.isHome ? 'vs' : '@'} {r.opponentName}
                </span>
                <span className="font-mono text-chalk-400 text-xs">
                  {r.isHome
                    ? `${r.homeSetsWon}–${r.awaySetsWon}`
                    : `${r.awaySetsWon}–${r.homeSetsWon}`
                  }
                </span>
                {r.hasDiscrepancy && (
                  <span
                    className="text-warning text-xs cursor-default"
                    title="Conflicting match data between teams — home team's data used"
                  >
                    ⚠
                  </span>
                )}
                <span className="text-chalk-600 text-xs shrink-0">
                  {new Date(r.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming fixtures */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-chalk-400">Upcoming fixtures</h2>
        {upcomingFixtures.length === 0 ? (
          <p className="text-chalk-500 text-sm">No upcoming fixtures scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcomingFixtures.map((f) => (
              <div key={f.fixtureId} className="card p-3 flex items-center gap-3 text-sm">
                <span className="text-chalk-600 text-xs w-8 shrink-0">{f.isHome ? 'H' : 'A'}</span>
                <span className="text-chalk-300 flex-1">
                  {f.isHome ? 'vs' : '@'} {f.opponentName}
                </span>
                <span className="text-chalk-500 text-xs">
                  {new Date(f.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/*
        Private intel — rendered ONLY when the API included it.
        No placeholder, no "locked" state, no indication this section exists
        to someone who doesn't have permission — consistent with the backend's
        structural absence approach.
      */}
      {privateIntel && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 flex items-center gap-2">
              Team Heatmap
              <span className="badge bg-spike-600/20 text-navy-700 text-xs">Your team only</span>
            </h2>
            <div className="card p-4 text-sm text-chalk-300">
              <Link to={privateIntel.heatmapUrl.replace('/api/v1', '')} className="text-navy-700 hover:underline">
                View full heatmap →
              </Link>
              <p className="text-chalk-600 text-xs mt-1">Shows aggregate court-zone event distribution across all matches.</p>
            </div>
          </section>

          {privateIntel.recentMatchReports.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-chalk-400 flex items-center gap-2">
                Recent Match Reports
                <span className="badge bg-spike-600/20 text-navy-700 text-xs">Your team only</span>
              </h2>
              <div className="space-y-2">
                {privateIntel.recentMatchReports.map((m) => (
                  <div key={m.matchId} className="card p-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="text-chalk-200 font-medium">vs {m.opponent}</span>
                      <span className="text-chalk-600 text-xs ml-2">
                        {new Date(m.matchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <Link to={`/matches/${m.matchId}/dashboard`} className="text-chalk-400 hover:text-chalk-200">
                        Dashboard
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
