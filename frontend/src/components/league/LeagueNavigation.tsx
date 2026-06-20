import { NavLink } from 'react-router-dom';

interface Props {
  seasonId: string;
}

export default function LeagueNavigation({ seasonId }: Props) {
  const base = `/leagues/seasons/${seasonId}`;
  const items = [
    { to: base, label: 'Overview' },
    { to: `${base}/fixtures`, label: 'Fixtures' },
    { to: `${base}/results`, label: 'Results' },
    { to: `${base}/standings`, label: 'Standings' },
  ];
  return (
    <nav className="flex gap-1 border-b border-court-700 mb-6">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            isActive
              ? 'px-4 py-2 text-sm font-medium text-spike-400 border-b-2 border-spike-500 -mb-px'
              : 'px-4 py-2 text-sm text-chalk-400 hover:text-chalk-200 border-b-2 border-transparent -mb-px'
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
