import { NavLink } from 'react-router-dom';

// Match-level tab group (Match Stats | Events | Track), one level down from
// TeamSubNav and styled identically to it. The Track tab only appears when the
// caller can track a live, in-progress match (via `trackable`) — players never
// can (Iteration 3 Task 6).
export default function MatchSubNav({ matchId, trackable = false }: { matchId: string; trackable?: boolean }) {
  const tabs = [
    { to: `/matches/${matchId}/dashboard`, label: 'Match Stats' },
    { to: `/matches/${matchId}/events`, label: 'Events' },
    ...(trackable ? [{ to: `/matches/${matchId}/track`, label: 'Track' }] : []),
  ];

  return (
    <div className="flex items-end border-b border-grey-200 pb-px overflow-x-auto">
      <div className="flex items-center gap-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `px-3.5 py-2 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-gold-500 text-navy-700 font-semibold'
                  : 'border-transparent text-grey-600 hover:text-navy-700'
              }`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
