import { randomUUID } from 'crypto';
import { InvitationStatus, TeamRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { addMember, isMember } from './teamMembership.service';

const EXPIRY_DAYS = 7;

export async function createInvitation(
  teamId: string,
  invitedById: string,
  email: string,
  role: TeamRole,
) {
  // Check the team exists
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw Object.assign(new Error('Team not found'), { statusCode: 404 });

  // Prevent duplicate pending invitation for the same email+team
  const existing = await prisma.invitation.findFirst({
    where: { teamId, email, status: InvitationStatus.PENDING },
  });
  if (existing) {
    throw Object.assign(
      new Error('A pending invitation already exists for this email on this team'),
      { statusCode: 409 },
    );
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return prisma.invitation.create({
    data: { email, teamId, invitedById, role, token, expiresAt },
    include: { team: { select: { id: true, name: true } }, invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
  if (inv.status !== InvitationStatus.PENDING) {
    throw Object.assign(new Error(`Invitation is ${inv.status.toLowerCase()}`), { statusCode: 409 });
  }
  if (inv.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: inv.id }, data: { status: InvitationStatus.EXPIRED } });
    throw Object.assign(new Error('Invitation has expired'), { statusCode: 410 });
  }

  // Verify the authenticated user's email matches the invitation
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw Object.assign(new Error('This invitation was sent to a different email address'), { statusCode: 403 });
  }

  const alreadyMember = await isMember(inv.teamId, userId);
  if (alreadyMember) {
    throw Object.assign(new Error('You are already a member of this team'), { statusCode: 409 });
  }

  await addMember(inv.teamId, userId, inv.role);

  return prisma.invitation.update({
    where: { id: inv.id },
    data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function declineInvitation(token: string, userId: string) {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
  if (inv.status !== InvitationStatus.PENDING) {
    throw Object.assign(new Error(`Invitation is already ${inv.status.toLowerCase()}`), { statusCode: 409 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw Object.assign(new Error('This invitation was sent to a different email address'), { statusCode: 403 });
  }

  return prisma.invitation.update({
    where: { id: inv.id },
    data: { status: InvitationStatus.DECLINED },
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function expireStaleInvitations() {
  return prisma.invitation.updateMany({
    where: { status: InvitationStatus.PENDING, expiresAt: { lt: new Date() } },
    data: { status: InvitationStatus.EXPIRED },
  });
}

export async function getTeamInvitations(teamId: string) {
  await expireStaleInvitations();
  return prisma.invitation.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
    include: { invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function getUserInvitations(email: string) {
  await expireStaleInvitations();
  return prisma.invitation.findMany({
    where: { email, status: InvitationStatus.PENDING },
    orderBy: { createdAt: 'desc' },
    include: {
      team: { select: { id: true, name: true, division: true, season: true } },
      invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}
