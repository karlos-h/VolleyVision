import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TermsGate from '../legal/TermsGate';
import { termsStepCovers } from '../../lib/termsGate';

export default function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // Deleting the account and live tracking stay open without accepting the
  // Terms (lib/termsGate.ts says why).
  if (user.termsRequired && termsStepCovers(location.pathname)) return <TermsGate />;
  return <Outlet />;
}
