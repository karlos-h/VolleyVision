import { useAuth } from '../context/AuthContext';
import { useViewMode } from '../context/ViewModeContext';
import CoachDashboardPage from './CoachDashboardPage';
import PlayerPortalPage from './PlayerPortalPage';

export default function DashboardPage() {
  const { user } = useAuth();
  const { viewMode } = useViewMode();

  if (!user) return null;

  // Portal is driven by the user's per-team capabilities (see ViewModeContext),
  // never by the global User.role flag.
  return viewMode === 'player' ? <PlayerPortalPage /> : <CoachDashboardPage />;
}
