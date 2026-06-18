import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/teams', label: 'Teams' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  COACH: 'Coach',
  PLAYER: 'Player',
  VIEWER: 'Viewer',
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
      <header className="sticky top-0 z-50 border-b border-court-800 bg-court-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-spike-500 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-court-950">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-1 3v3H6l4 4 4-4h-3V7H9z" />
              </svg>
            </div>
            <span className="font-bold text-chalk-100 tracking-tight">VolleyVision</span>
            <span className="badge bg-spike-600/20 text-spike-400 ml-1">Phase 5</span>
          </div>

          {/* Nav + Auth */}
          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1 mr-2">
              {NAV.map((item) => (
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
                {/* User chip */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-court-800 border border-court-700">
                  <div className="w-6 h-6 rounded-full bg-spike-600 flex items-center justify-center text-xs font-bold text-white">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <span className="text-chalk-200 text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="badge bg-court-700 text-chalk-500 text-xs">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="nav-link text-chalk-400 hover:text-red-400"
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
