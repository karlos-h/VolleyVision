import { useState } from 'react';
import type { StandingsRow } from '../../types';

type SortKey = 'points' | 'wins' | 'matchesPlayed' | 'setsWon' | 'setDifferential' | 'teamName';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'teamName',        label: 'Team' },
  { key: 'matchesPlayed',   label: 'MP',  numeric: true },
  { key: 'wins',            label: 'W',   numeric: true },
  { key: 'points',          label: 'Pts', numeric: true },
  { key: 'setsWon',         label: 'SW',  numeric: true },
  { key: 'setDifferential', label: 'Diff', numeric: true },
];

interface Props {
  rows: StandingsRow[];
}

export default function StandingsTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === 'teamName'); // default asc for name, desc for numbers
    }
  }

  const filtered = rows.filter((r) =>
    r.teamName.toLowerCase().includes(filter.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  function arrow(key: SortKey) {
    if (key !== sortKey) return null;
    return sortAsc ? ' ↑' : ' ↓';
  }

  if (!rows.length) {
    return (
      <div className="card p-8 text-center text-chalk-500 text-sm">
        No teams in this season yet — standings will appear once teams join.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        className="input w-full max-w-xs text-sm"
        placeholder="Filter by team name…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-court-700">
              <th className="text-left text-chalk-500 text-xs font-semibold uppercase tracking-wide py-2 pr-4 w-6">#</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${col.numeric ? 'text-right' : 'text-left'} text-chalk-500 text-xs font-semibold uppercase tracking-wide py-2 px-2 cursor-pointer select-none hover:text-chalk-300`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}{arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.leagueTeamId} className="border-b border-court-800 hover:bg-court-800/40">
                <td className="py-2.5 pr-4 text-chalk-600 text-xs font-mono">{i + 1}</td>
                <td className="py-2.5 px-2 font-medium text-chalk-100">{row.teamName}</td>
                <td className="py-2.5 px-2 text-right font-mono text-chalk-300">{row.matchesPlayed}</td>
                <td className="py-2.5 px-2 text-right font-mono text-emerald-400">{row.wins}</td>
                <td className="py-2.5 px-2 text-right font-mono font-bold text-spike-400">{row.points}</td>
                <td className="py-2.5 px-2 text-right font-mono text-chalk-300">{row.setsWon}</td>
                <td className={`py-2.5 px-2 text-right font-mono ${row.setDifferential >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.setDifferential >= 0 ? `+${row.setDifferential}` : row.setDifferential}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-chalk-600">MP = Matches Played · W = Wins · Pts = Points (Win=2, Loss=1) · SW = Sets Won · Diff = Set Differential</p>
    </div>
  );
}
