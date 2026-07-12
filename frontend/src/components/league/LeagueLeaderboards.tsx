import type { PlayerLeaderboardEntry } from '../../types';

interface LeaderboardProps {
  title: string;
  entries: PlayerLeaderboardEntry[];
  formatValue: (v: number) => string;
  valueLabel: string;
  emptyMessage?: string;
}

function Leaderboard({ title, entries, formatValue, valueLabel, emptyMessage }: LeaderboardProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-chalk-400">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-chalk-600 text-xs">{emptyMessage ?? 'Not enough data yet.'}</p>
      ) : (
        <div className="space-y-1">
          {entries.slice(0, 10).map((entry, i) => (
            <div key={entry.playerId} className="flex items-center gap-3 py-1.5 px-3 rounded bg-court-800/60 text-sm">
              <span className="text-chalk-600 font-mono text-xs w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-chalk-200 truncate">{entry.playerName}</div>
                <div className="text-chalk-500 text-xs truncate">{entry.teamName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-semibold text-spike-400">{formatValue(entry.value)}</div>
                <div className="text-chalk-600 text-xs">{valueLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  kills: PlayerLeaderboardEntry[];
  aces: PlayerLeaderboardEntry[];
  blocks: PlayerLeaderboardEntry[];
  digs: PlayerLeaderboardEntry[];
  assists: PlayerLeaderboardEntry[];
}

export default function LeagueLeaderboards({ kills, aces, blocks, digs, assists }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Leaderboard title="Top Killers" entries={kills} formatValue={(v) => String(v)} valueLabel="Kills" />
      <Leaderboard title="Top Servers" entries={aces}  formatValue={(v) => String(v)} valueLabel="Aces" />
      <Leaderboard title="Top Blockers" entries={blocks} formatValue={(v) => v.toFixed(1)} valueLabel="Blocks" />
      <Leaderboard title="Top Defenders" entries={digs} formatValue={(v) => String(v)} valueLabel="Digs" />
      <Leaderboard title="Top Setters" entries={assists} formatValue={(v) => String(v)} valueLabel="Assists" />
    </div>
  );
}
