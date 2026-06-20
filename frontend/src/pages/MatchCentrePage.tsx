import { useParams, Link } from 'react-router-dom';
import { useMatchCentre } from '../hooks';
import LeagueNavigation from '../components/league/LeagueNavigation';
import type { LiveFixture, RecentlyFinishedFixture, UpcomingFixtureSummary } from '../types';

// ─── Live score card ───────────────────────────────────────────────────────────

function LiveCard({ f }: { f: LiveFixture }) {
  return (
    <div className="card p-4 border-l-4 border-emerald-500 space-y-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · Set {f.currentSet}
        </span>
        <span className="text-chalk-600 text-xs">
          {new Date(f.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex-1 text-right">
          <Link to={`/leagues/league-teams/${f.homeLeagueTeamId}/profile`} className="font-semibold text-chalk-100 hover:text-spike-400 text-sm">
            {f.homeTeam}
          </Link>
        </div>

        {/* Current set score */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-mono font-bold text-2xl text-chalk-100 w-8 text-right">{f.homeSetScore}</span>
          <span className="text-chalk-500 text-lg">–</span>
          <span className="font-mono font-bold text-2xl text-chalk-100 w-8 text-left">{f.awaySetScore}</span>
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <Link to={`/leagues/league-teams/${f.awayLeagueTeamId}/profile`} className="font-semibold text-chalk-100 hover:text-spike-400 text-sm">
            {f.awayTeam}
          </Link>
        </div>
      </div>

      {/* Sets scoreboard */}
      <div className="flex justify-center gap-4 text-xs">
        <span className="text-chalk-400">
          Sets: <span className="font-mono text-chalk-200">{f.homeSetsWon}</span>
          <span className="text-chalk-600 mx-1">–</span>
          <span className="font-mono text-chalk-200">{f.awaySetsWon}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Recently finished card ───────────────────────────────────────────────────

function FinishedCard({ f }: { f: RecentlyFinishedFixture }) {
  const homeWon = f.homeSetsWon > f.awaySetsWon;
  return (
    <div className="card p-3 flex items-center gap-3 text-sm">
      <div className="flex-1 text-right">
        <Link to={`/leagues/league-teams/${f.homeLeagueTeamId}/profile`}
          className={`font-semibold hover:underline ${homeWon ? 'text-chalk-100' : 'text-chalk-400'}`}>
          {f.homeTeam}
        </Link>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`font-mono font-bold text-lg w-5 text-right ${homeWon ? 'text-chalk-100' : 'text-chalk-500'}`}>{f.homeSetsWon}</span>
        <span className="text-chalk-600">–</span>
        <span className={`font-mono font-bold text-lg w-5 text-left ${!homeWon ? 'text-chalk-100' : 'text-chalk-500'}`}>{f.awaySetsWon}</span>
      </div>
      <div className="flex-1 text-left">
        <Link to={`/leagues/league-teams/${f.awayLeagueTeamId}/profile`}
          className={`font-semibold hover:underline ${!homeWon ? 'text-chalk-100' : 'text-chalk-400'}`}>
          {f.awayTeam}
        </Link>
      </div>
      {f.hasDiscrepancy && (
        <span className="text-yellow-500 text-xs cursor-default shrink-0" title="Data mismatch — home team's data used">⚠</span>
      )}
    </div>
  );
}

// ─── Upcoming card ────────────────────────────────────────────────────────────

function UpcomingCard({ f }: { f: UpcomingFixtureSummary }) {
  const dateStr = new Date(f.scheduledDate).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const timeStr = new Date(f.scheduledDate).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className="card p-3 flex items-center gap-3 text-sm">
      <div className="flex-1 text-right">
        <Link to={`/leagues/league-teams/${f.homeLeagueTeamId}/profile`} className="font-semibold text-chalk-200 hover:text-spike-400">
          {f.homeTeam}
        </Link>
      </div>
      <div className="text-center shrink-0 text-xs text-chalk-500">
        <div>{dateStr}</div>
        <div className="text-chalk-600">{timeStr}</div>
      </div>
      <div className="flex-1 text-left">
        <Link to={`/leagues/league-teams/${f.awayLeagueTeamId}/profile`} className="font-semibold text-chalk-200 hover:text-spike-400">
          {f.awayTeam}
        </Link>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MatchCentrePage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data, isLoading, error, dataUpdatedAt } = useMatchCentre(seasonId!);

  return (
    <div className="space-y-8 max-w-3xl">
      <LeagueNavigation seasonId={seasonId!} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-chalk-100">Match Centre</h1>
          <p className="text-chalk-500 text-sm mt-0.5">Auto-refreshes every 20 seconds.</p>
        </div>
        {dataUpdatedAt > 0 && (
          <span className="text-chalk-600 text-xs">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {isLoading && <p className="text-chalk-400 text-sm">Loading match centre…</p>}
      {error && <p className="text-red-400 text-sm">Failed to load match centre.</p>}

      {data && (
        <>
          {/* Live Now */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide flex items-center gap-2">
              Live Now
              {data.live.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </h2>
            {data.live.length === 0 ? (
              <p className="text-chalk-600 text-sm">No matches in progress right now.</p>
            ) : (
              <div className="space-y-3">
                {data.live.map((f) => <LiveCard key={f.fixtureId} f={f} />)}
              </div>
            )}
          </section>

          {/* Recently Finished */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">Recently Finished</h2>
            {data.recentlyFinished.length === 0 ? (
              <p className="text-chalk-600 text-sm">No completed results yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentlyFinished.map((f) => <FinishedCard key={f.fixtureId} f={f} />)}
              </div>
            )}
          </section>

          {/* Upcoming */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">
              Up Next
              <span className="text-chalk-600 font-normal ml-1 normal-case text-xs">(next {data.upcoming.length})</span>
            </h2>
            {data.upcoming.length === 0 ? (
              <p className="text-chalk-600 text-sm">No upcoming fixtures scheduled.</p>
            ) : (
              <div className="space-y-2">
                {data.upcoming.map((f) => <UpcomingCard key={f.fixtureId} f={f} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
