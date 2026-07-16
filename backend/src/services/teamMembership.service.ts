import { AccessTier, TeamRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { defaultAccessTiers } from './permission.service';

const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  // Iteration 3 — per-member access tiers, so the members UI can render/edit them.
  rosterAccess: true,
  invitationAccess: true,
  matchAccess: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profileImage: true,
    },
  },
} as const;

/** Return all memberships for a team. */
export async function getTeamMembers(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) throw new AppError(404, 'Team not found.');
  return prisma.teamMembership.findMany({
    where: { teamId },
    select: memberSelect,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
}

/** Return all team memberships for a given user. */
export async function getUserTeams(userId: string) {
  return prisma.teamMembership.findMany({
    where: { userId },
    select: {
      id: true,
      role: true,
      joinedAt: true,
      team: {
        select: {
          id: true,
          name: true,
          division: true,
          season: true,
          ownerId: true,
          leagueSeasonId: true,
          _count: { select: { players: true, matches: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

/** Add a user to a team with a given role. */
export async function addMember(teamId: string, userId: string, role: TeamRole) {
  const [team, user] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ]);
  if (!team) throw new AppError(404, 'Team not found.');
  if (!user) throw new AppError(404, 'User not found.');

  const existing = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (existing) throw new AppError(409, 'User is already a member of this team.');

  return prisma.teamMembership.create({
    data: { teamId, userId, role, ...defaultAccessTiers(role) },
    select: memberSelect,
  });
}

/**
 * Update a member's role. Changing the role re-seeds the three access tiers to
 * that role's defaults — a role change is a coarse action, and this avoids a
 * demoted member silently keeping elevated access. A coach can then fine-tune.
 */
export async function updateMemberRole(membershipId: string, role: TeamRole) {
  const membership = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new AppError(404, 'Membership not found.');
  return prisma.teamMembership.update({
    where: { id: membershipId },
    data: { role, ...defaultAccessTiers(role) },
    select: memberSelect,
  });
}

/** Update one or more of a member's access tiers, leaving role untouched. */
export async function updateMemberAccess(
  membershipId: string,
  tiers: { rosterAccess?: AccessTier; invitationAccess?: AccessTier; matchAccess?: AccessTier },
) {
  const membership = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new AppError(404, 'Membership not found.');
  return prisma.teamMembership.update({
    where: { id: membershipId },
    data: {
      ...(tiers.rosterAccess ? { rosterAccess: tiers.rosterAccess } : {}),
      ...(tiers.invitationAccess ? { invitationAccess: tiers.invitationAccess } : {}),
      ...(tiers.matchAccess ? { matchAccess: tiers.matchAccess } : {}),
    },
    select: memberSelect,
  });
}

/** Remove a member from a team. */
export async function removeMember(membershipId: string) {
  const membership = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new AppError(404, 'Membership not found.');
  await prisma.teamMembership.delete({ where: { id: membershipId } });
}

/** Returns true if the user is a member of the team. */
export async function isMember(teamId: string, userId: string): Promise<boolean> {
  const m = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { id: true },
  });
  return m !== null;
}

/**
 * Ensures the team owner has a HEAD_COACH membership record.
 * Called after claim or transfer so ownership and membership stay in sync.
 */
export async function syncOwnerMembership(teamId: string, ownerId: string) {
  const existing = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: ownerId, teamId } },
  });
  if (existing) {
    // Upgrade to HEAD_COACH if they were previously a lower role
    if (existing.role !== 'HEAD_COACH') {
      await prisma.teamMembership.update({
        where: { id: existing.id },
        data: { role: 'HEAD_COACH' },
      });
    }
  } else {
    await prisma.teamMembership.create({
      data: { teamId, userId: ownerId, role: 'HEAD_COACH' },
    });
  }
}

/** Search users by name or email fragment — used for the add-member lookup. */
export async function searchUsers(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    take: 20,
    orderBy: { firstName: 'asc' },
  });
}
