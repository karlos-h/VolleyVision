import { AccessTier, TeamRole } from '@prisma/client';
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

const HEAD_COACH_PERMISSIONS = [
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
];

const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  HEAD_COACH: new Set(HEAD_COACH_PERMISSIONS),
  // Iteration 3 — Manager: head-coach authority minus ownership transfer, which
  // stays owner-exclusive (a distinct, more sensitive action).
  MANAGER: new Set(HEAD_COACH_PERMISSIONS.filter((p) => p !== Permission.TRANSFER_OWNERSHIP)),
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
 * Approval authority — who may approve/reject other members' pending
 * ApprovalRequests and is themselves exempt from the queue. The team owner,
 * any HEAD_COACH, and (Iteration 3) any MANAGER.
 * (getUserTeamRole already maps the owner to role 'HEAD_COACH'.)
 */
export async function isApprovalAuthority(userId: string, teamId: string): Promise<boolean> {
  const { role, isOwner } = await getUserTeamRole(userId, teamId);
  return isOwner || role === 'HEAD_COACH' || role === 'MANAGER';
}

// ─── Per-member access tiers (Iteration 3) ────────────────────────────────────

/** The three mutation categories a member's access can be dialled per team. */
export type AccessCategory = 'roster' | 'invitation' | 'match';

const CATEGORY_PERMISSIONS: Record<AccessCategory, Permission[]> = {
  roster: [Permission.MANAGE_ROSTER],
  invitation: [Permission.INVITE_USERS],
  match: [Permission.CREATE_MATCH, Permission.EDIT_MATCH, Permission.DELETE_MATCH],
};

/**
 * Role-derived default tiers, applied when a membership is created. A coach can
 * override any of these per member afterwards; the override is authoritative.
 */
export function defaultAccessTiers(role: TeamRole): {
  rosterAccess: AccessTier;
  invitationAccess: AccessTier;
  matchAccess: AccessTier;
} {
  const all = (tier: AccessTier) => ({ rosterAccess: tier, invitationAccess: tier, matchAccess: tier });
  switch (role) {
    case 'HEAD_COACH':
    case 'MANAGER':
      return all(AccessTier.FULL_ACCESS);
    case 'ASSISTANT_COACH':
    case 'STATISTICIAN':
      return all(AccessTier.APPROVAL_REQUIRED);
    default: // PLAYER, VIEWER
      return all(AccessTier.VIEW_ONLY);
  }
}

/**
 * Effective access tier for a member in one category. Null means "not a member"
 * (treated as no access). The owner always has FULL_ACCESS and cannot be locked
 * out of their own team.
 */
export async function getAccessTier(
  userId: string,
  teamId: string,
  category: AccessCategory,
): Promise<AccessTier | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } });
  if (team?.ownerId === userId) return AccessTier.FULL_ACCESS;

  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { rosterAccess: true, invitationAccess: true, matchAccess: true },
  });
  if (!membership) return null;

  return category === 'roster'
    ? membership.rosterAccess
    : category === 'invitation'
      ? membership.invitationAccess
      : membership.matchAccess;
}

/** True when the member may perform the category's action at all (queued or immediate). */
export async function canActInCategory(userId: string, teamId: string, category: AccessCategory): Promise<boolean> {
  const tier = await getAccessTier(userId, teamId, category);
  return tier === AccessTier.APPROVAL_REQUIRED || tier === AccessTier.FULL_ACCESS;
}

/**
 * Permissions the user effectively holds on a team, folding per-member access
 * tiers over the static role map for the three tiered categories. This is what
 * the frontend reads (via /:id/my-role) so its gating matches backend enforcement
 * — e.g. a Statistician granted FULL_ACCESS on invitations gains INVITE_USERS.
 */
export async function getEffectivePermissions(userId: string, teamId: string): Promise<Permission[]> {
  const { role, isOwner } = await getUserTeamRole(userId, teamId);
  if (!role) return [];
  const set = new Set(getPermissionsForRole(role));
  if (isOwner) return [...set]; // owner keeps everything

  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { rosterAccess: true, invitationAccess: true, matchAccess: true },
  });
  if (!membership) return [...set];

  const apply = (tier: AccessTier, category: AccessCategory) => {
    for (const perm of CATEGORY_PERMISSIONS[category]) {
      if (tier === AccessTier.VIEW_ONLY) set.delete(perm);
      else set.add(perm);
    }
  };
  apply(membership.rosterAccess, 'roster');
  apply(membership.invitationAccess, 'invitation');
  apply(membership.matchAccess, 'match');
  return [...set];
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
