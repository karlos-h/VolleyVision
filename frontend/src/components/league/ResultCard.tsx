import { Link } from 'react-router-dom';
import type { LeagueMatch, ResolvedFixtureResult } from '../../types';

interface Props {
  fixture: LeagueMatch;
  result: ResolvedFixtureResult;
  myTeamIds?: Set<string>;
}

export default function ResultCard({ fixture, result, myTeamIds = new Set() }: Props) {
  const homeTeam = fixture.homeLeagueTeam.team;
  const awayTeam = fixture.awayLeagueTeam.team;
  const iMyHome = myTeamIds.has(fixture.homeLeagueTeam.teamId);
  const iMyAway = myTeamIds.has(fixture.awayLeagueTeam.teamId);

  const homeWon = result.homeSetsWon > result.awaySetsWon;
  const awayWon = result.awaySetsWon > result.homeSetsWon;

  const dateStr = new Date(fixture.scheduledDate).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-chalk-500">{dateStr}</span>
        {result.hasDiscrepancy && (
          <span
            className="badge bg-warning/20 text-warning text-xs cursor-default"
            title="Both teams linked different results. The home team's data is used as authoritative."
          >
            ⚠ Data mismatch
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className={`flex-1 text-right ${iMyHome ? 'text-spike-400' : homeWon ? 'text-chalk-100' : 'text-chalk-400'} font-semibold text-sm`}>
          <Link to={`/leagues/league-teams/${fixture.homeLeagueTeam.id}/profile`} className="hover:underline">
            {homeTeam.name}
          </Link>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1 shrink-0">
          <span className={`font-mono font-bold text-lg w-6 text-right ${homeWon ? 'text-chalk-100' : 'text-chalk-500'}`}>
            {result.homeSetsWon}
          </span>
          <span className="text-chalk-600 text-sm">–</span>
          <span className={`font-mono font-bold text-lg w-6 text-left ${awayWon ? 'text-chalk-100' : 'text-chalk-500'}`}>
            {result.awaySetsWon}
          </span>
        </div>

        {/* Away team */}
        <div className={`flex-1 text-left ${iMyAway ? 'text-spike-400' : awayWon ? 'text-chalk-100' : 'text-chalk-400'} font-semibold text-sm`}>
          <Link to={`/leagues/league-teams/${fixture.awayLeagueTeam.id}/profile`} className="hover:underline">
            {awayTeam.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
