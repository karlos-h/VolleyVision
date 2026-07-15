import { NavLink, Link } from 'react-router-dom';

// Match-level tab group (Stats | Events), one level down from TeamSubNav and
// styled identically to it. Live tracking is a distinct action, not a tab — the
// parent decides whether to offer it (in-progress + the caller can track) via
// `trackable`.
export default function MatchSubNav({ matchId, trackable = false }: { matchId: string; trackable?: boolean }) {
  const tabs = [
    { to: `/matches/${matchId}/dashboard`, label: 'Stats' },
    { to: `/matches/${matchId}/events`, label: 'Events' },
  ];

  return (
    <div className="flex items-end justify-between gap-3 border-b border-grey-200 pb-px overflow-x-auto">
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
      {trackable && (
        <Link to={`/track/${matchId}`} className="btn-primary text-sm py-1.5 px-3 mb-1.5 shrink-0">
          Track live
        </Link>
      )}
    </div>
  );
}
