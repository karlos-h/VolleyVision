import type { TeamRankingEntry } from '../../types';

interface Props {
  title: string;
  entries: TeamRankingEntry[];
  formatValue: (v: number) => string;
  emptyMessage?: string;
}

export default function LeagueRankingCards({ title, entries, formatValue, emptyMessage }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-chalk-400 uppercase tracking-wide">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-chalk-600 text-xs">{emptyMessage ?? 'Not enough data yet (min. 2 matches per team).'}</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, i) => (
            <div key={entry.leagueTeamId} className="flex items-center gap-3 py-1.5 px-3 rounded bg-court-800/60 text-sm">
              <span className="text-chalk-600 font-mono text-xs w-4 shrink-0">{i + 1}</span>
              <span className="flex-1 text-chalk-200 truncate">{entry.teamName}</span>
              <span className="font-mono font-semibold text-spike-400 shrink-0">{formatValue(entry.value)}</span>
              <span className="text-chalk-600 text-xs shrink-0">{entry.matchesPlayed}M</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
