// 9.5.4: the per-request authz memo reads each user / team / membership row
// once per request, with every status and body as before. Today's bodies come
// from the same functions called outside a request (no memo).
import assert from 'node:assert/strict';
import { db, resetDb, callsFor } from '../testing/installFakePrisma';
import { withServer, tokenFor } from '../testing/http';
import { getUserTeamRole, getEffectivePermissions } from '../services/permission.service';

const TEAM = 'team1';
const MEMBERS: Record<string, object> = {
  stat: { role: 'STATISTICIAN', rosterAccess: 'VIEW_ONLY', invitationAccess: 'FULL_ACCESS', matchAccess: 'APPROVAL_REQUIRED' },
};
let order: string[] = [];

function world() {
  resetDb();
  order = [];
  db.user.findUnique = async (a: any) => { order.push('user'); return { tokenVersion: 0, role: a.where.id === 'admin' ? 'ADMIN' : 'COACH' }; };
  db.team.findUnique = async (a: any) => { order.push('team'); return a.where.id === TEAM ? { ownerId: 'owner' } : null; };
  db.teamMembership.findUnique = async (a: any) => { order.push('membership'); return MEMBERS[a.where.userId_teamId.userId] ?? null; };
}

const counts = () => ({
  user: callsFor('user', 'findUnique').length,
  team: callsFor('team', 'findUnique').length,
  membership: callsFor('teamMembership', 'findUnique').length,
});

async function req(base: string, method: string, path: string, who: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${tokenFor(who)}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const ops = Number(/ops=(\d+)/.exec(res.headers.get('server-timing') ?? '')?.[1]);
  return { status: res.status, body: text ? JSON.parse(text) : null, ops };
}

async function today(who: string) {
  const { role, isOwner } = await getUserTeamRole(who, TEAM);
  return { role, isOwner, permissions: await getEffectivePermissions(who, TEAM) };
}

async function myRole(base: string, who: string, expected: { user: number; team: number; membership: number }) {
  world();
  const r = await req(base, 'GET', `/api/v1/teams/${TEAM}/my-role`, who);
  assert.equal(r.status, 200, who);
  assert.deepEqual(counts(), expected, `${who}: ${order.join(',')}`);
  assert.equal(r.ops, expected.user + expected.team + expected.membership, 'Server-Timing counts the same');
  assert.deepEqual(r.body, await today(who), `${who}: same body as without the memo`);
}

async function main() {
  await withServer(async (base) => {
    // Member: was 9 reads (user 2, team 3, membership 4).
    await myRole(base, 'stat', { user: 1, team: 1, membership: 1 });
    // Owner: was 6 (user 1, team 3, membership 2).
    await myRole(base, 'owner', { user: 1, team: 1, membership: 1 });
    // Global admin, not a member: was 7 (user 2, team 3, membership 2).
    await myRole(base, 'admin', { user: 1, team: 1, membership: 1 });
    assert.deepEqual((await today('admin')), { role: null, isOwner: false, permissions: [] });

    // Outsider: 404, team read before anything team-specific (was user, team, user, membership).
    world();
    const out = await req(base, 'GET', `/api/v1/teams/${TEAM}/my-role`, 'outsider');
    assert.equal(out.status, 404);
    assert.deepEqual(order, ['user', 'team', 'membership']);

    // requireTeamPermission: 404 before 403 still.
    world();
    assert.equal((await req(base, 'PATCH', `/api/v1/teams/${TEAM}`, 'outsider', { name: 'x' })).status, 404, 'outsider');
    assert.deepEqual(counts(), { user: 1, team: 1, membership: 1 }, 'isGlobalAdmin reused the auth read (was user 2)');
    world();
    assert.equal((await req(base, 'PATCH', '/api/v1/teams/nope', 'outsider', { name: 'x' })).status, 404, 'missing team');
    world();
    const denied = await req(base, 'PATCH', `/api/v1/teams/${TEAM}`, 'stat', { name: 'x' });
    assert.equal(denied.status, 403, 'a member without MANAGE_TEAM');
    assert.deepEqual(counts(), { user: 1, team: 1, membership: 1 });

    // Nothing carries over between requests.
    world();
    await req(base, 'GET', `/api/v1/teams/${TEAM}/my-role`, 'stat');
    await req(base, 'GET', `/api/v1/teams/${TEAM}/my-role`, 'stat');
    assert.deepEqual(counts(), { user: 2, team: 2, membership: 2 });

    // The store survives body parsing: createTeam's isGlobalAdmin is a memo hit.
    world();
    db.team.count = async () => 0;
    db.team.create = async (a: any) => ({ id: 'NEW', ...a.data });
    db.teamMembership.create = async () => ({});
    db.auditLog.create = async () => ({});
    const created = await req(base, 'POST', '/api/v1/teams', 'pat', { name: 'Hawks', season: '2026' });
    assert.equal(created.status, 201);
    assert.equal(callsFor('user', 'findUnique').length, 1, 'one user read for requireAuth + isGlobalAdmin');
  });
  console.log('http.authzMemo.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
