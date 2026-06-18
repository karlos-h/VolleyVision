import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  profileImage: true,
} as const;

/** All teams owned by a given user. */
export async function getOwnedTeams(userId: string) {
  return prisma.team.findMany({
    where: { ownerId: userId },
    include: { _count: { select: { players: true, matches: true } } },
    orderBy: { name: 'asc' },
  });
}

/** Assign ownership of an unowned team to a user. Throws if already owned. */
export async function assignOwner(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, 'Team not found.');
  if (team.ownerId !== null) throw new AppError(403, 'This team already has an owner.');

  return prisma.team.update({
    where: { id: teamId },
    data: { ownerId: userId },
    include: { owner: { select: ownerSelect } },
  });
}

/** Transfer ownership from current owner to another user. Only current owner may call. */
export async function transferOwnership(teamId: string, requesterId: string, newOwnerId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, 'Team not found.');
  if (team.ownerId !== requesterId) throw new AppError(403, 'Only the current owner can transfer ownership.');

  const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId } });
  if (!newOwner) throw new AppError(404, 'Target user not found.');

  return prisma.team.update({
    where: { id: teamId },
    data: { ownerId: newOwnerId },
    include: { owner: { select: ownerSelect } },
  });
}

/** Throws 403 if the requesting user does not own the team. */
export async function verifyOwnership(teamId: string, userId: string): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true } });
  if (!team) throw new AppError(404, 'Team not found.');
  if (team.ownerId !== userId) throw new AppError(403, 'You do not own this team.');
}

/** Returns the owner of a team, or null if unowned. */
export async function getTeamOwner(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { owner: { select: ownerSelect } },
  });
  if (!team) throw new AppError(404, 'Team not found.');
  return team.owner;
}
