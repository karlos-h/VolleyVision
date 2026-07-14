import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useMyInvitations } from '../../hooks';
import { features } from '../../config/features';
import {
  GridIcon, TeamIcon, SparkIcon, MailIcon, UserIcon,
  SlidersIcon, BellIcon, ChevronIcon, MenuIcon, CloseIcon, LogoutIcon,
} from './icons';

type NavItem = {
  to: string;
  label: string;
  icon: (p: { className?: string }) => JSX.Element;
  /** Renders the pending-invitation count as a badge on this item. */
  badge?: boolean;
};

const NAV_AUTH: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { to: '/teams', label: 'Teams', icon: TeamIcon },
  ...(features.leagues ? [{ to: '/leagues', label: 'League Hub', icon: SparkIcon }] : []),
  { to: '/invitations', label: 'Invitations', icon: MailIcon, badge: true },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

// Longest-prefix match wins, so /teams/:id/matches still resolves to "Teams".
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/dashboard', 'Dashboard'],
  ['/coach', 'Dashboard'],
  ['/player', 'Dashboard'],
  ['/teams', 'Teams'],
  ['/leagues', 'League Hub'],
  ['/invitations', 'Invitations'],
  ['/profile', 'Profile'],
  ['/matches', 'Match'],
  ['/players', 'Player analytics'],
];

function pageTitle(pathname: string) {
  const hit = PAGE_TITLES.filter(([prefix]) => pathname.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? 'VolleyVision';
}

function BrandMark({ className = 'w-[30px] h-[30px]' }: { className?: string }) {
  return <img src="/vv-icon.svg" alt="" className={className} />;
}

function Initials({ user, size }: { user: { firstName: string; lastName: string }; size: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-10 h-10 text-sm';
  return (
    <span
      className={`${dims} shrink-0 rounded-full bg-navy-500 border-2 border-gold-500
                  grid place-items-center font-display font-bold text-white`}
    >
      {user.firstName[0]}{user.lastName[0]}
    </span>
  );
}

function ViewModeToggle() {
  const { viewMode, setViewMode, isDual } = useViewMode();
  if (!isDual) return null;

  const base = 'px-3 py-1 text-xs font-semibold rounded-md transition-colors';
  return (
    <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-grey-50 border border-grey-200">
      <button
        type="button"
        onClick={() => setViewMode('coach')}
        className={viewMode === 'coach' ? `${base} bg-navy-700 text-white` : `${base} text-grey-600 hover:text-navy-700`}
      >
        Coach
      </button>
      <button
        type="button"
        onClick={() => setViewMode('player')}
        className={viewMode === 'player' ? `${base} bg-navy-700 text-white` : `${base} text-grey-600 hover:text-navy-700`}
      >
        Player
      </button>
    </div>
  );
}

/** Bottom-of-sidebar identity chip. Expands to reveal Sign out. */
function UserChip({
  user,
  viewMode,
  onSignOut,
}: {
  user: { firstName: string; lastName: string };
  viewMode: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-grey-50 border border-grey-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-grey-200/50 transition-colors"
      >
        <Initials user={user} size="sm" />
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-semibold text-grey-900 truncate">
            {user.firstName} {user.lastName}
          </span>
          <span className="block text-[11px] text-grey-600 capitalize">{viewMode} view</span>
        </span>
        <ChevronIcon
          className={`w-4 h-4 ml-auto shrink-0 text-grey-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-grey-200 p-1.5">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium
                       text-grey-600 hover:text-error hover:bg-white transition-colors"
          >
            <LogoutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({
  pendingCount,
  onSignOut,
  onNavigate,
  user,
  viewMode,
}: {
  pendingCount: number;
  onSignOut: () => void;
  onNavigate: () => void;
  user: { firstName: string; lastName: string };
  viewMode: string;
}) {
  return (
    <aside className="w-[246px] shrink-0 h-full bg-white border-r border-grey-200 flex flex-col gap-6 p-[18px] pt-6">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-1.5">
        <BrandMark />
        <span className="font-display font-bold text-[19px] tracking-tight text-navy-700">
          VolleyVision
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-grey-400">MENU</p>
        {NAV_AUTH.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
          >
            <Icon className="w-[19px] h-[19px] shrink-0" />
            {label}
            {badge && pendingCount > 0 && (
              <span className="ml-auto badge bg-gold-500 text-navy-900">{pendingCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {/* No /settings route exists yet — Settings points at Profile, which is
            where the only user-editable settings currently live. */}
        <NavLink to="/profile" onClick={onNavigate} className="nav-link">
          <SlidersIcon className="w-[19px] h-[19px] shrink-0" />
          Settings
        </NavLink>
        <UserChip user={user} viewMode={viewMode} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}

/** Logged-out chrome: no sidebar, just a light header. */
function PublicShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white border-b border-grey-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="w-7 h-7" />
            <span className="font-display font-bold text-lg tracking-tight text-navy-700">
              VolleyVision
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <NavLink to="/teams" className="nav-link">Teams</NavLink>
            <NavLink to="/login" className="nav-link">Sign in</NavLink>
            <NavLink to="/register" className="btn-primary text-sm px-4 py-2">Register</NavLink>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { viewMode } = useViewMode();
  const { data: invitations } = useMyInvitations();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isTracking = location.pathname.startsWith('/track/');

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // The tracking screen is chrome-free and tablet-optimised — it must not be
  // wrapped by the shell.
  if (isTracking) return <Outlet />;
  if (!user) return <PublicShell />;

  const pendingCount = invitations?.length ?? 0;

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  const sidebarProps = {
    pendingCount,
    onSignOut: handleSignOut,
    user,
    viewMode,
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — persistent from lg up */}
      <div className="hidden lg:flex sticky top-0 h-screen">
        <Sidebar {...sidebarProps} onNavigate={() => {}} />
      </div>

      {/* Sidebar — drawer below lg */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-navy-900/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="relative h-full">
            <Sidebar {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="relative m-4 w-10 h-10 rounded-xl bg-white border border-grey-200
                       grid place-items-center text-grey-600"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-10 h-10 shrink-0 rounded-xl bg-white border border-grey-200
                         grid place-items-center text-grey-600 hover:text-navy-700 transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-[25px] tracking-tight text-grey-900 truncate">
              {pageTitle(location.pathname)}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ViewModeToggle />

            <Link
              to="/invitations"
              aria-label={pendingCount > 0 ? `Invitations (${pendingCount} pending)` : 'Invitations'}
              className="relative w-10 h-10 rounded-xl bg-white border border-grey-200
                         grid place-items-center text-grey-600 hover:text-navy-700 transition-colors"
            >
              <BellIcon className="w-[19px] h-[19px]" />
              {pendingCount > 0 && (
                <span className="absolute top-2 right-2.5 w-[7px] h-[7px] rounded-full bg-gold-500 border-[1.5px] border-white" />
              )}
            </Link>

            <Link to="/profile" aria-label="Profile">
              <Initials user={user} size="md" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-5 sm:px-7 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
