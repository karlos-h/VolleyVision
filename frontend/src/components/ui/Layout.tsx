import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { features } from '../../config/features';

const NAV_PUBLIC = [
  { to: '/teams', label: 'Teams' },
];

const NAV_AUTH = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/teams', label: 'Teams' },
  { to: '/my-teams', label: 'My Teams' },
  ...(features.leagues ? [{ to: '/leagues', label: 'League Hub' }] : []),
  { to: '/invitations', label: 'Invitations' },
  { to: '/profile', label: 'Profile' },
];

function ViewModeToggle() {
  const { viewMode, setViewMode, isDual } = useViewMode();
  if (!isDual) return null;

  const base = 'px-3 py-1 text-xs font-semibold rounded-md transition-colors';
  return (
    <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-navy-700 border border-navy-600">
      <button
        type="button"
        onClick={() => setViewMode('coach')}
        className={viewMode === 'coach' ? `${base} bg-gold-600 text-white` : `${base} text-navy-300 hover:text-navy-100`}
      >
        Coach
      </button>
      <button
        type="button"
        onClick={() => setViewMode('player')}
        className={viewMode === 'player' ? `${base} bg-gold-600 text-white` : `${base} text-navy-300 hover:text-navy-100`}
      >
        Player
      </button>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { viewMode, isDual } = useViewMode();
  const isTracking = location.pathname.startsWith('/track/');

  if (isTracking) {
    return <Outlet />;
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-navy-700 bg-navy-900/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gold-500 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-navy-900">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-1 3v3H6l4 4 4-4h-3V7H9z" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight">VolleyVision</span>
          </div>

          {/* Nav + Auth */}
          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1 mr-2">
              {(user ? NAV_AUTH : NAV_PUBLIC).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {user ? (
              <div className="flex items-center gap-3">
                <ViewModeToggle />
                {/* User chip */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-700 border border-navy-600">
                  <div className="w-6 h-6 rounded-full bg-gold-600 flex items-center justify-center text-xs font-bold text-white">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <span className="text-navy-100 text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </span>
                  {!isDual && (
                    <span className="badge bg-navy-600 text-navy-300 text-xs capitalize">
                      {viewMode}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="nav-link text-navy-300 hover:text-error-dark"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <NavLink to="/login" className="nav-link">Sign in</NavLink>
                <NavLink to="/register" className="btn-primary text-sm px-4 py-2">
                  Register
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
