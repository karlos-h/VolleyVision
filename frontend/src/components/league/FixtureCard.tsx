import type { LeagueMatch } from '../../types';

interface Props {
  fixture: LeagueMatch;
  myTeamIds?: Set<string>;
  /** 'pending' fixtures have passed their scheduled date but aren't resolved */
  isPending?: boolean;
}

export default function FixtureCard({ fixture, myTeamIds = new Set(), isPending }: Props) {
  const homeTeam = fixture.homeLeagueTeam.team;
  const awayTeam = fixture.awayLeagueTeam.team;
  const iMyHome = myTeamIds.has(fixture.homeLeagueTeam.teamId);
  const iMyAway = myTeamIds.has(fixture.awayLeagueTeam.teamId);

  const dateObj = new Date(fixture.scheduledDate);
  const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`card p-4 flex flex-col gap-3 ${isPending ? 'border-l-4 border-yellow-600/50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-chalk-500">{dateStr} · {timeStr}</span>
        {isPending && (
          <span className="badge bg-yellow-900/30 text-yellow-400 text-xs">Awaiting result</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Home */}
        <div className={`flex-1 text-right ${iMyHome ? 'text-spike-400' : 'text-chalk-200'} font-semibold text-sm`}>
          {homeTeam.name}
        </div>

        <div className="text-chalk-600 text-xs font-mono shrink-0">vs</div>

        {/* Away */}
        <div className={`flex-1 text-left ${iMyAway ? 'text-spike-400' : 'text-chalk-200'} font-semibold text-sm`}>
          {awayTeam.name}
        </div>
      </div>

      {/* Link status — show which sides have linked matches */}
      <div className="flex gap-2 justify-center">
        <span className={`text-xs ${fixture.homeMatchId ? 'text-emerald-400' : 'text-chalk-600'}`}>
          {fixture.homeMatchId ? '✓ Home linked' : '— Home unlinked'}
        </span>
        <span className="text-chalk-700">·</span>
        <span className={`text-xs ${fixture.awayMatchId ? 'text-emerald-400' : 'text-chalk-600'}`}>
          {fixture.awayMatchId ? '✓ Away linked' : '— Away unlinked'}
        </span>
      </div>
    </div>
  );
}
