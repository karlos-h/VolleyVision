// One-time backfill (Team Chat foundation, 2026-07): create the single
// Channel { type: TEAM } for every existing Team that lacks one. New teams get
// theirs at creation (controllers/teams.ts); getOrCreateTeamChannel self-heals
// any stragglers. Safe to re-run — it only creates what's missing.
//
// Run: npx ts-node prisma/backfill-team-channels.ts

import { ChannelType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teamsWithoutChannel = await prisma.team.findMany({
    where: { channels: { none: { type: ChannelType.TEAM } } },
    select: { id: true, name: true },
  });

  if (teamsWithoutChannel.length === 0) {
    console.log('All teams already have a TEAM channel — nothing to do.');
    return;
  }

  for (const team of teamsWithoutChannel) {
    await prisma.channel.create({ data: { teamId: team.id, type: ChannelType.TEAM } });
    console.log(`Created TEAM channel for "${team.name}" (${team.id})`);
  }
  console.log(`Backfilled ${teamsWithoutChannel.length} team channel(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
