import { Link } from 'react-router-dom';
import type { LeagueSeason } from '../../types';

interface Props {
  seasons: LeagueSeason[];
}

export default function LeagueOverviewCards({ seasons }: Props) {
  if (!seasons.length) {
    return (
      <div className="card p-10 text-center space-y-2">
        <p className="text-chalk-300 font-medium">No league seasons yet</p>
        <p className="text-chalk-500 text-sm">Ask your league administrator to add your team to a season.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {seasons.map((season) => (
        <Link
          key={season.id}
          to={`/leagues/seasons/${season.id}`}
          className="card p-5 flex flex-col gap-3 hover:border-spike-600/40 transition-colors"
        >
          <div>
            <p className="text-xs text-chalk-500 uppercase tracking-wide font-semibold">
              {season.league.name}
              {season.league.division && ` · ${season.league.division}`}
            </p>
            <h3 className="text-chalk-100 font-bold text-lg leading-tight mt-0.5">{season.name}</h3>
            <p className="text-chalk-500 text-xs mt-1">
              {new Date(season.startDate).toLocaleDateString()}
              {season.endDate ? ` – ${new Date(season.endDate).toLocaleDateString()}` : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-court-800 rounded-xl py-2 text-center">
              <div className="font-mono font-bold text-spike-400">{season._count.teams}</div>
              <div className="text-xs text-chalk-400">Teams</div>
            </div>
            <div className="flex-1 bg-court-800 rounded-xl py-2 text-center">
              <div className="font-mono font-bold text-chalk-200">{season._count.fixtures}</div>
              <div className="text-xs text-chalk-400">Fixtures</div>
            </div>
          </div>
          <span className="text-spike-400 text-xs font-medium self-end">View season →</span>
        </Link>
      ))}
    </div>
  );
}
