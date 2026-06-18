import { useAuth } from '../context/AuthContext';
import CoachDashboardPage from './CoachDashboardPage';
import PlayerPortalPage from './PlayerPortalPage';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === 'PLAYER') return <PlayerPortalPage />;

  // COACH, ADMIN, VIEWER — all get the coach/manager view
  return <CoachDashboardPage />;
}
