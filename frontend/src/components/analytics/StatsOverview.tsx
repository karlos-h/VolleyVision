import { Link } from 'react-router-dom';
import type { PlayerStatLine, StatLine } from '../../types';
import { POSITION_LABELS } from '../../types';

function percentage(value: number | null) {
  if (value === null) return '-';

  // Volleyball convention:
  // 0.250 -> .250
  // 1.000 -> 1.000
  // -0.125 -> -.125

  if (Math.abs(value) >= 1) {
    return value.toFixed(3);
  }

  const sign = value < 0 ? '-' : '';
  return `${sign}.${Math.abs(value).toFixed(3).split('.')[1]}`;
}

function decimal(value: number | null, places = 2) {
  return value === null ? '-' : value.toFixed(places);
}

export function StatsCards({ stats }: { stats: StatLine }) {
  const cards = [
    { label: 'Kills', value: stats.kills, detail: `${stats.attackAttempts} attempts` },
    { label: 'Hitting %', value: percentage(stats.hittingPercentage), detail: `${stats.attackErrors} errors` },
    { label: 'Aces', value: stats.aces, detail: `${stats.serviceErrors} service errors` },
    { label: 'Passing', value: decimal(stats.passingRating), detail: `${stats.passAttempts} receptions` },
    { label: 'Blocks', value: decimal(stats.totalBlocks, 1), detail: `${stats.soloBlocks} solo, ${stats.blockAssists} assists` },
    { label: 'Digs', value: stats.digs, detail: `${stats.digErrors} errors` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="card p-4">
          <p className="text-xs text-navy-300">{card.label}</p>
          <p className="tabular-nums text-2xl font-bold text-white mt-1">{card.value}</p>
          <p className="text-xs text-grey-600 mt-1">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function PlayerStatsTable({ rows }: { rows: PlayerStatLine[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-navy-700 text-navy-100 text-xs">
          <tr>
            <th className="text-left px-4 py-3">Player</th>
            <th className="text-center px-3 py-3">K</th>
            <th className="text-center px-3 py-3">E</th>
            <th className="text-center px-3 py-3">TA</th>
            <th className="text-center px-3 py-3">Hit %</th>
            <th className="text-center px-3 py-3">Ace</th>
            <th className="text-center px-3 py-3">SE</th>
            <th className="text-center px-3 py-3">Pass</th>
            <th className="text-center px-3 py-3">Blk</th>
            <th className="text-center px-3 py-3">Dig</th>
            <th className="text-center px-3 py-3">Ast</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-700">
          {rows.map((row) => (
            <tr key={row.player.id} className="hover:bg-navy-700/50">
              <td className="px-4 py-3">
                <span className="tabular-nums text-gold-500 mr-2">#{row.player.jerseyNumber}</span>
                <Link
                  to={`/players/${row.player.id}/dashboard`}
                  className="font-medium text-white hover:text-gold-500 transition-colors"
                >
                  {row.player.firstName} {row.player.lastName}
                </Link>
                <span className="text-xs text-grey-600 ml-2">{POSITION_LABELS[row.player.position]}</span>
              </td>
              <td className="stat-cell">{row.kills}</td>
              <td className="stat-cell">{row.attackErrors}</td>
              <td className="stat-cell">{row.attackAttempts}</td>
              <td className="stat-cell font-semibold text-gold-500">{percentage(row.hittingPercentage)}</td>
              <td className="stat-cell">{row.aces}</td>
              <td className="stat-cell">{row.serviceErrors}</td>
              <td className="stat-cell">{decimal(row.passingRating)}</td>
              <td className="stat-cell">{decimal(row.totalBlocks, 1)}</td>
              <td className="stat-cell">{row.digs}</td>
              <td className="stat-cell">{row.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="text-navy-300 text-sm p-5">No player statistics yet.</p>}
    </div>
  );
}
