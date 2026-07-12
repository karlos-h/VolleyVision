import type { LeagueTeamSummary } from '../../types';

interface Props {
  teams: LeagueTeamSummary[];
  teamId: string;
  from: string;
  to: string;
  onTeamId: (v: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}

export default function FixtureFiltersBar({ teams, teamId, from, to, onTeamId, onFrom, onTo }: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="text-xs text-chalk-500 mb-1 block">Team</label>
        <select className="input text-sm" value={teamId} onChange={(e) => onTeamId(e.target.value)}>
          <option value="">All teams</option>
          {teams.map((lt) => (
            <option key={lt.id} value={lt.teamId}>{lt.team.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-chalk-500 mb-1 block">From</label>
        <input className="input text-sm" type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-chalk-500 mb-1 block">To</label>
        <input className="input text-sm" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
      {(teamId || from || to) && (
        <button
          className="btn-secondary text-xs py-1.5 self-end"
          onClick={() => { onTeamId(''); onFrom(''); onTo(''); }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
