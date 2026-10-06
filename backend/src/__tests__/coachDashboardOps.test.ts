// Phase 9.5.2: the dashboard read the same team ids in each of its five blocks
// (12 queries). The ids are now read once; ?lite=1 also skips the two blocks no
// shipped client reads. Counts come from the per-request db op counter.
import assert from 'node:assert/strict';
import { db, resetDb, callsFor } from '../testing/installFakePrisma';
import { withRequestStore, getRequestStore } from '../lib/serverTiming';
import { getCoachDashboard, getCoachingStats } from '../services/coachPortal.service';

function stub() {
  resetDb();
  db.team.findMany = async (args: any) =>
    args.select ? [{ id: 'A' }] : [{ id: 'A', name: 'Own', _count: { players: 1, matches: 1 } }];
  db.teamMembership.findMany = async (args: any) =>
    args.select
      ? [{ teamId: 'B' }]
      : [{ role: 'COACH', team: { id: 'B', name: 'Mem', ownerId: 'x', _count: { players: 1, matches: 1 } } }];
  db.match.findMany = async () => [];
}

async function ops<T>(fn: () => Promise<T>) {
  return withRequestStore(async () => {
    const result = await fn();
    return { result, n: getRequestStore()!.dbOps };
  });
}

async function main() {
  stub();
  const lite = await ops(() => getCoachDashboard('u', undefined, { lite: true }));
  assert.ok(lite.n <= 3, `lite used ${lite.n} ops`);
  assert.ok(!('coachingStats' in lite.result) && !('recentMatches' in lite.result));
  assert.deepEqual(callsFor('match', 'findMany')[0][0].where.teamId, { in: ['A', 'B'] });

  stub();
  const full = await ops(() => getCoachDashboard('u'));
  assert.deepEqual(
    Object.keys(full.result).sort(),
    ['coachingStats', 'memberTeams', 'ownedTeams', 'recentMatches', 'upcomingMatches'],
  );
  assert.equal(callsFor('team', 'findMany').length, 1, 'owned read is shared');
  assert.equal(callsFor('teamMembership', 'findMany').length, 1, 'membership read is shared');
  assert.equal(full.result.coachingStats?.teamsOwned, 1);

  stub();
  await getCoachingStats('u');
  assert.equal(callsFor('team', 'findMany').length, 1, '/coach/stats still reads its own ids');
  assert.equal(callsFor('teamMembership', 'findMany').length, 1);

  console.log(`coachDashboardOps.test.ts passed (lite ${lite.n} ops, full ${full.n} ops)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
