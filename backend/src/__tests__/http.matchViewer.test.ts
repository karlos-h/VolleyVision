// 9.5.7: GET /matches/:id and the match analytics carry a `viewer` block (the
// same answer as /teams/:id/my-role) so the SPA needs no sequential /my-role
// call. Additive: every older field and status is unchanged.
import assert from 'node:assert/strict';
import { db, resetDb, callsFor } from '../testing/installFakePrisma';
import { withServer, tokenFor } from '../testing/http';
import { getUserTeamRole, getEffectivePermissions } from '../services/permission.service';

const PLAYERS = [
  { id: 'p1', firstName: 'Ann', lastName: 'A', jerseyNumber: 1, position: 'SETTER', teamId: 'T', userId: 'ann' },
  { id: 'p2', firstName: 'Ben', lastName: 'B', jerseyNumber: 2, position: 'LIBERO', teamId: 'T', userId: 'ben' },
];
const ROLES: Record<string, string> = { ann: 'PLAYER' };

function world() {
  resetDb();
  db.user.findUnique = async () => ({ tokenVersion: 0, role: 'COACH' });
  db.team.findUnique = async () => ({ ownerId: 'owner' });
  db.teamMembership.findUnique = async (a: any) => {
    const role = ROLES[a.where.userId_teamId.userId];
    return role ? { role, rosterAccess: 'VIEW_ONLY', invitationAccess: 'VIEW_ONLY', matchAccess: 'VIEW_ONLY' } : null;
  };
  db.match.findUnique = async (a: any) => a.select
    ? { teamId: 'T' }
    : {
        id: 'M', teamId: 'T', opponent: 'Wolves', setScores: [], homeScore: 0, awayScore: 0, homeSetsWon: 0, awaySetsWon: 0,
        team: { id: 'T', name: 'Falcons', ownerId: 'owner', players: PLAYERS }, events: [], _count: { events: 0, scoreAdjustments: 0 },
      };
}

async function get(base: string, path: string, who?: string) {
  const res = await fetch(`${base}${path}`, { headers: who ? { authorization: `Bearer ${tokenFor(who)}` } : {} });
  return { status: res.status, body: (await res.json().catch(() => null)) as any, ops: Number(/ops=(\d+)/.exec(res.headers.get('server-timing') ?? '')?.[1]) };
}

async function main() {
  await withServer(async (base) => {
    for (const path of ['/api/v1/matches/M', '/api/v1/analytics/matches/M']) {
      world();
      const owner = await get(base, path, 'owner');
      assert.equal(owner.status, 200, path);
      assert.equal(owner.body.viewer.role, 'HEAD_COACH');
      assert.equal(owner.body.viewer.isOwner, true);
      assert.equal(owner.body.viewer.canTrack, true);
      assert.equal(owner.body.viewer.seesEveryPlayer, true);
      // Identical to /my-role's own functions.
      assert.deepEqual(owner.body.viewer.permissions, await getEffectivePermissions('owner', 'T'));
      assert.deepEqual({ role: owner.body.viewer.role, isOwner: owner.body.viewer.isOwner }, await getUserTeamRole('owner', 'T'));

      world();
      const ann = await get(base, path, 'ann');
      assert.equal(ann.body.viewer.role, 'PLAYER');
      assert.equal(ann.body.viewer.canTrack, false, 'PLAYER lacks TRACK_MATCH');
      assert.equal(ann.body.viewer.seesEveryPlayer, false);
      assert.ok(!ann.body.viewer.permissions.includes('TRACK_MATCH'));

      // Visibility still first: an outsider is a 404, no viewer.
      world();
      const out = await get(base, path, 'outsider');
      assert.equal(out.status, 404, path);
      assert.equal(out.body.viewer, undefined);
    }

    // Anonymous reads of a visible match cannot happen (no public teams), so the
    // anonymous block is checked on the helper itself.
    const { viewerBlock } = await import('../services/permission.service');
    assert.deepEqual(await viewerBlock(null, 'T'), { role: null, isOwner: false, canTrack: false, seesEveryPlayer: false, permissions: [] });

    // getMatch: team read once (visibility's), not again by the controller.
    world();
    const r = await get(base, '/api/v1/matches/M', 'owner');
    assert.equal(r.status, 200);
    assert.equal(callsFor('team', 'findUnique').length, 1, 'one team read for the whole request');
    assert.equal(callsFor('user', 'findUnique').length, 1);
    assert.equal(callsFor('teamMembership', 'findUnique').length, 1);
    console.log(`GET /matches/:id as owner: ops=${r.ops} (match 2, team 1, user 1, membership 1)`);
  });
  console.log('http.matchViewer.test.ts passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
