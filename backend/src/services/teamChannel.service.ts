// Team Chat foundation — TEAM channel access.
//
// Every team has exactly one Channel { type: TEAM } (enforced by
// @@unique([teamId, type])). It is created with the team (see createTeam) and
// backfilled for pre-existing teams, but this getter is lazy-safe so a missing
// row self-heals rather than 500ing the chat page.

import { Channel, ChannelType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/** Return the team's TEAM channel, creating it if missing. */
export async function getOrCreateTeamChannel(teamId: string): Promise<Channel> {
  const existing = await prisma.channel.findUnique({
    where: { teamId_type: { teamId, type: ChannelType.TEAM } },
  });
  if (existing) return existing;

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) throw new AppError(404, 'Team not found.');

  try {
    return await prisma.channel.create({ data: { teamId, type: ChannelType.TEAM } });
  } catch (err) {
    // Two callers raced past the findUnique; the loser lands here on the
    // unique(teamId, type) violation and reads the winner's row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const channel = await prisma.channel.findUnique({
        where: { teamId_type: { teamId, type: ChannelType.TEAM } },
      });
      if (channel) return channel;
    }
    throw err;
  }
}
