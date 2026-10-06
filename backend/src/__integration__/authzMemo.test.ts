// 9.5.4 on real Prisma + Postgres: the authz memo serves repeat reads, and
// any write (committed, rolled back, or inside an interactive transaction)
// switches it off so a role is never served stale.
import assert from 'node:assert/strict';
import { prisma, makeUser, makeTeam, addMember, cleanup } from './harness';
import { runSerializable } from '../lib/prisma';
import { withRequestStore, getRequestStore } from '../lib/serverTiming';
import { getUserTeamRole } from '../services/permission.service';

const ops = () => getRequestStore()!.dbOps;

async function main() {
  try {
    const coach = await makeUser('coach');
    const member = await makeUser('member');
    const team = await makeTeam(coach, 'Memo');
    const m = await addMember(team.id, member, 'PLAYER');
    const setRole = (role: 'PLAYER' | 'STATISTICIAN') => prisma.teamMembership.update({ where: { id: m.id }, data: { role } });
    const roleNow = async () => (await getUserTeamRole(member.id, team.id)).role;

    // (a) A read doesn't switch the memo off: the second call is a hit.
    await withRequestStore(async () => {
      assert.equal(await roleNow(), 'PLAYER');
      const before = ops();
      assert.equal(await roleNow(), 'PLAYER');
      assert.equal(ops(), before, 'memo hit, no query');
      assert.ok(getRequestStore()!.memo, 'still on');
    });

    // (b) A committed write: the next read sees it.
    await withRequestStore(async () => {
      assert.equal(await roleNow(), 'PLAYER');
      await setRole('STATISTICIAN');
      assert.equal(getRequestStore()!.memo, null);
      assert.equal(await roleNow(), 'STATISTICIAN');
    });
    await setRole('PLAYER');

    // (c) A rolled-back transaction: the original role, re-read.
    await withRequestStore(async () => {
      assert.equal(await roleNow(), 'PLAYER');
      await assert.rejects(prisma.$transaction(async (tx) => {
        await tx.teamMembership.update({ where: { id: m.id }, data: { role: 'STATISTICIAN' } });
        throw new Error('roll back');
      }));
      const before = ops();
      assert.equal(await roleNow(), 'PLAYER');
      assert.ok(ops() > before, 'read again, not from the memo');
    });

    // (d) The case "clear the memo on write" would get wrong: inside an
    // interactive transaction a read via the global client sees the old
    // committed row; once committed, the request must see the new one.
    await withRequestStore(async () => {
      let inside: string | null = null;
      await prisma.$transaction(async (tx) => {
        await tx.teamMembership.update({ where: { id: m.id }, data: { role: 'STATISTICIAN' } });
        inside = await roleNow();
      });
      assert.equal(inside, 'PLAYER', 'the global client cannot see the uncommitted write');
      assert.equal(await roleNow(), 'STATISTICIAN', 'after COMMIT: the new role, not a memoised old one');
    });
    await setRole('PLAYER');

    // (e) dbOps counts raw SQL and transaction operations; raw SQL turns the memo off.
    await withRequestStore(async () => {
      await prisma.$queryRaw`SELECT 1`;
      assert.equal(ops(), 1);
      assert.equal(getRequestStore()!.memo, null, 'raw SQL switches the memo off');
    });
    await withRequestStore(async () => {
      await prisma.$transaction(async (tx) => { await tx.user.findUnique({ where: { id: member.id } }); });
      await prisma.$transaction([prisma.user.count(), prisma.team.count()]);
      assert.equal(ops(), 3);
      await runSerializable(async (tx) => tx.teamMembership.update({ where: { id: m.id }, data: { role: 'PLAYER' } }));
      assert.equal(ops(), 4);
      assert.equal(getRequestStore()!.memo, null, 'a write inside runSerializable switches it off');
    });

    // (f) Join codes stay omitted from full Team reads, inside a transaction too.
    for (const t of [
      await prisma.team.findUnique({ where: { id: team.id } }),
      await runSerializable(async (tx) => tx.team.findUnique({ where: { id: team.id } })),
    ]) {
      assert.ok(t && !('playerJoinCode' in t) && !('staffJoinCode' in t), JSON.stringify(t));
    }

    console.log('authzMemo: all tests passed');
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
