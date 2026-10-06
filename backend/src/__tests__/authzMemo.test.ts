// 9.5.4: any non-read database operation switches the authz memo off for the
// rest of the request, so a role read after a write is always fresh.
import assert from 'node:assert/strict';
import { db, resetDb, callsFor } from '../testing/installFakePrisma';
import { runSerializable } from '../lib/prisma';
import { withRequestStore } from '../lib/serverTiming';
import { getUserTeamRole, isGlobalAdmin } from '../services/permission.service';

let role = 'PLAYER';
function world() {
  resetDb();
  role = 'PLAYER';
  db.team.findUnique = async () => ({ ownerId: 'owner' });
  db.teamMembership.findUnique = async (a: any) => (a.where.userId_teamId.userId === 'u' ? { role } : null);
  db.teamMembership.update = async () => { role = 'STATISTICIAN'; return {}; };
  db.user.findUnique = async () => ({ role: 'COACH', tokenVersion: 0 });
}
const reads = () => callsFor('teamMembership', 'findUnique').length;

async function afterWrite(name: string, write: () => Promise<unknown>) {
  world();
  await withRequestStore(async () => {
    assert.equal((await getUserTeamRole('u', 'T')).role, 'PLAYER');
    assert.equal((await getUserTeamRole('u', 'T')).role, 'PLAYER');
    assert.equal(reads(), 1, `${name}: second read is a memo hit`);
    await write().catch(() => undefined);
    role = 'STATISTICIAN'; // what the write did (a throwing one counts as "maybe did")
    assert.equal((await getUserTeamRole('u', 'T')).role, 'STATISTICIAN', name);
    assert.equal(reads(), 2, `${name}: re-read after the write`);
    await getUserTeamRole('u', 'T');
    assert.equal(reads(), 3, `${name}: the memo stays off for the rest of the request`);
  });
}

async function main() {
  await afterWrite('update', () => db.teamMembership.update({ where: { id: 'm' }, data: { role: 'STATISTICIAN' } }));
  await afterWrite('$executeRaw', () => db.$executeRaw`UPDATE team_memberships SET role = 'STATISTICIAN'`);
  await afterWrite('runSerializable', () => runSerializable(async (tx: any) => tx.teamMembership.update({ where: { id: 'm' }, data: {} })));
  await afterWrite('a write that throws', () => {
    db.teamMembership.update = async () => { throw new Error('conflict'); };
    return db.teamMembership.update({ where: { id: 'm' }, data: {} });
  });
  await afterWrite('an unrelated model', () => {
    db.approvalRequest.updateMany = async () => ({ count: 0 });
    return db.approvalRequest.updateMany({ where: {}, data: {} });
  });

  // Keys carry the user: one member's row never answers for another.
  world();
  await withRequestStore(async () => {
    assert.equal((await getUserTeamRole('u', 'T')).role, 'PLAYER');
    assert.equal((await getUserTeamRole('v', 'T')).role, null);
    assert.equal(reads(), 2);
    assert.deepEqual(callsFor('teamMembership', 'findUnique').map((c) => c[0].where.userId_teamId.userId), ['u', 'v']);
  });

  // Parallel callers share one query; a failed read isn't kept.
  world();
  await withRequestStore(async () => {
    await Promise.all([getUserTeamRole('u', 'T'), getUserTeamRole('u', 'T'), isGlobalAdmin('u'), isGlobalAdmin('u')]);
    assert.deepEqual([reads(), callsFor('team', 'findUnique').length, callsFor('user', 'findUnique').length], [1, 1, 1]);
    let fail = true;
    db.user.findUnique = async () => { if (fail) { fail = false; throw new Error('db down'); } return { role: 'ADMIN' }; };
    await assert.rejects(isGlobalAdmin('w'));
    assert.equal(await isGlobalAdmin('w'), true, 'retried, not the cached rejection');
  });

  // Outside a request nothing is memoised: today's counts.
  world();
  await getUserTeamRole('u', 'T');
  await getUserTeamRole('u', 'T');
  assert.deepEqual([reads(), callsFor('team', 'findUnique').length], [2, 2]);

  console.log('authzMemo.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
