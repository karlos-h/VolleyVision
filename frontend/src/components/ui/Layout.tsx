import { Outlet, NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/teams', label: 'Teams' },
];

export default function Layout() {
  const location = useLocation();
  const isTracking = location.pathname.startsWith('/track/');

  // Full-screen focus mode for the tracking screen — hide all chrome
  if (isTracking) {
    return <Outlet />;
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
            <span className="badge bg-spike-600/20 text-spike-400 ml-1">Phase 2</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
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
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
