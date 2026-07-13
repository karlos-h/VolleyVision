import { prisma } from '../lib/prisma';

// ─── Permission enum ──────────────────────────────────────────────────────────

export enum Permission {
  // Team management
  MANAGE_TEAM     = 'MANAGE_TEAM',     // edit, delete, settings
  TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP',
  // Membership
  MANAGE_MEMBERS  = 'MANAGE_MEMBERS',
  INVITE_USERS    = 'INVITE_USERS',
  // Roster (Stabilization Pass 2) — attempt player create/update/delete.
  // Head coaches apply immediately; assistant coaches route through approval.
  MANAGE_ROSTER   = 'MANAGE_ROSTER',
  // Matches
  CREATE_MATCH    = 'CREATE_MATCH',
  EDIT_MATCH      = 'EDIT_MATCH',
  DELETE_MATCH    = 'DELETE_MATCH',
  // Live tracking
  TRACK_MATCH     = 'TRACK_MATCH',
  // Read access
  VIEW_ANALYTICS  = 'VIEW_ANALYTICS',
  VIEW_REPORTS    = 'VIEW_REPORTS',
  VIEW_TEAM       = 'VIEW_TEAM',
}

// ─── Role → permission map ────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  HEAD_COACH: new Set([
    Permission.MANAGE_TEAM,
    Permission.TRANSFER_OWNERSHIP,
    Permission.MANAGE_MEMBERS,
    Permission.INVITE_USERS,
    Permission.MANAGE_ROSTER,
    Permission.CREATE_MATCH,
    Permission.EDIT_MATCH,
    Permission.DELETE_MATCH,
    Permission.TRACK_MATCH,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_TEAM,
  ]),
  ASSISTANT_COACH: new Set([
    Permission.MANAGE_ROSTER,
    Permission.CREATE_MATCH,
    Permission.EDIT_MATCH,
    Permission.TRACK_MATCH,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_TEAM,
  ]),
  STATISTICIAN: new Set([
    Permission.TRACK_MATCH,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_TEAM,
  ]),
  PLAYER: new Set([
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_TEAM,
  ]),
  VIEWER: new Set([
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_TEAM,
  ]),
};

export function getPermissionsForRole(role: string): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

// ─── Team-context permission check ───────────────────────────────────────────

export async function getUserTeamRole(
  userId: string,
  teamId: string,
): Promise<{ role: string | null; isOwner: boolean }> {
  const [team, membership] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } }),
    prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
      select: { role: true },
    }),
  ]);

  const isOwner = team?.ownerId === userId;
  const role = isOwner ? 'HEAD_COACH' : (membership?.role ?? null);
  return { role, isOwner };
}

export async function hasTeamPermission(
  userId: string,
  teamId: string,
  permission: Permission,
): Promise<boolean> {
  const { role } = await getUserTeamRole(userId, teamId);
  if (!role) return false;
  return roleHasPermission(role, permission);
}

/**
 * Stabilization Pass 2 — approval-queue exemption.
 * The team owner and any HEAD_COACH member apply structural changes
 * immediately; everyone else routes through the approval queue.
 * (getUserTeamRole already maps the owner to role 'HEAD_COACH'.)
 */
export async function isHeadCoachOrOwner(userId: string, teamId: string): Promise<boolean> {
  const { role, isOwner } = await getUserTeamRole(userId, teamId);
  return isOwner || role === 'HEAD_COACH';
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export async function canManageTeam(userId: string, teamId: string) {
  return hasTeamPermission(userId, teamId, Permission.MANAGE_TEAM);
}

export async function canTrackMatch(userId: string, teamId: string) {
  return hasTeamPermission(userId, teamId, Permission.TRACK_MATCH);
}

export async function canManageMembers(userId: string, teamId: string) {
  return hasTeamPermission(userId, teamId, Permission.MANAGE_MEMBERS);
}

export async function canViewAnalytics(userId: string, teamId: string) {
  return hasTeamPermission(userId, teamId, Permission.VIEW_ANALYTICS);
}

export async function canInviteUsers(userId: string, teamId: string) {
  return hasTeamPermission(userId, teamId, Permission.INVITE_USERS);
}
