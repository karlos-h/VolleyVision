import { ReactNode } from 'react';
import { useTeamRole } from '../../hooks';

interface Props {
  teamId: string;
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders `children` only when the current user has `permission` on `teamId`.
 * Renders `fallback` (default: nothing) otherwise.
 *
 * While the role is loading, nothing is rendered to avoid flash of unauthorized UI.
 */
export default function PermissionGuard({ teamId, permission, children, fallback = null }: Props) {
  const { data, isLoading } = useTeamRole(teamId);

  if (isLoading) return null;
  if (!data?.permissions.includes(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
