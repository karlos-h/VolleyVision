/**
 * Delete every team with no owner.
 *
 *   npx ts-node scripts/cleanup-orphaned-teams.ts --dry-run   (report only)
 *   npx ts-node scripts/cleanup-orphaned-teams.ts             (delete)
 *
 * Ownerless teams are leftover dev/test data from before team ownership was
 * introduced. They are unreachable under the members-only visibility model
 * (nobody owns them and nobody can claim them), so they are deleted outright.
 *
 * This MUST run before the migration that makes Team.ownerId non-nullable —
 * that migration fails while any null-owner rows remain.
 *
 * Every dependent relation (Player, Match, TeamMembership, Invitation,
 * ApprovalRequest, PlayerTeamLink, LeagueTeam) cascades from Team via
 * onDelete: Cascade, so a plain delete is sufficient.
 *
 * Idempotent — safe to re-run; a second run finds nothing to do.
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // `ownerId` is non-nullable in the current schema but still nullable in the
  // database until the migration runs, so query the raw column directly rather
  // than through the typed client.
  const orphaned = await prisma.$queryRaw<{ id: string; name: string; season: string }[]>`
    SELECT id, name, season FROM teams WHERE owner_id IS NULL ORDER BY name ASC
  `;

  if (orphaned.length === 0) {
    console.log('✅ No ownerless teams. Nothing to do.');
    return;
  }

  console.log(`Found ${orphaned.length} ownerless team(s):\n`);

  for (const team of orphaned) {
    const [players, matches, memberships] = await Promise.all([
      prisma.player.count({ where: { teamId: team.id } }),
      prisma.match.count({ where: { teamId: team.id } }),
      prisma.teamMembership.count({ where: { teamId: team.id } }),
    ]);
    console.log(
      `  • ${team.name} (season ${team.season}, id ${team.id})\n` +
        `    ${players} player(s), ${matches} match(es), ${memberships} membership(s) — all cascade`,
    );
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing deleted.');
    return;
  }

  const { count } = await prisma.team.deleteMany({
    where: { id: { in: orphaned.map((t) => t.id) } },
  });
  console.log(`\n🗑️  Deleted ${count} ownerless team(s) and all their dependent rows.`);

  const [{ remaining }] = await prisma.$queryRaw<{ remaining: bigint }[]>`
    SELECT COUNT(*)::bigint AS remaining FROM teams WHERE owner_id IS NULL
  `;
  console.log(`Teams still without an owner: ${Number(remaining)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
