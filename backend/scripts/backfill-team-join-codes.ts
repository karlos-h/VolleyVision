/**
 * Backfill playerJoinCode / staffJoinCode for every team missing one.
 *
 *   npx ts-node scripts/backfill-team-join-codes.ts
 *
 * Teams created after the join-codes feature get both codes at creation
 * (controllers/teams.ts); this one-off covers teams that existed before the
 * columns were added, so no team is ever missing a code in the UI.
 *
 * Idempotent — safe to re-run; teams that already have both codes are skipped.
 */
import { prisma } from '../src/lib/prisma';
import { generateUniqueCode } from '../src/lib/joinCode';

const playerCodeExists = async (code: string) =>
  (await prisma.team.findUnique({ where: { playerJoinCode: code }, select: { id: true } })) !== null;
const staffCodeExists = async (code: string) =>
  (await prisma.team.findUnique({ where: { staffJoinCode: code }, select: { id: true } })) !== null;

async function main() {
  const teams = await prisma.team.findMany({
    where: { OR: [{ playerJoinCode: null }, { staffJoinCode: null }] },
    select: { id: true, name: true, playerJoinCode: true, staffJoinCode: true },
  });
  if (teams.length === 0) {
    console.log('All teams already have join codes — nothing to do.');
    return;
  }

  for (const team of teams) {
    const data: { playerJoinCode?: string; staffJoinCode?: string } = {};
    if (!team.playerJoinCode) data.playerJoinCode = await generateUniqueCode(playerCodeExists);
    if (!team.staffJoinCode) data.staffJoinCode = await generateUniqueCode(staffCodeExists);
    await prisma.team.update({ where: { id: team.id }, data });
    console.log(`${team.name} (${team.id}): player=${data.playerJoinCode ?? 'kept'} staff=${data.staffJoinCode ?? 'kept'}`);
  }
  console.log(`Backfilled ${teams.length} team(s).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
