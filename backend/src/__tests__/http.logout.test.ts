// 9.6.0.2: logging out revokes that token on the server (its jti), and
// "sign out of all devices" bumps tokenVersion. The revoked check rides on the
// one per-request user read, so no authed request gains a query.
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { db, resetDb, callsFor } from '../testing/installFakePrisma';
import { withServer, tokenFor } from '../testing/http';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { loadUser, loadAuthUser } from '../services/permission.service';
import { withRequestStore } from '../lib/serverTiming';

const decode = (t: string) => jwt.decode(t) as { jti?: unknown; exp: number };

function fakeRes() {
  const res: any = { statusCode: null, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

/** The fake user row: revoked when the query's jti filter names a revoked jti. */
function world(revoked: Set<string> = new Set()) {
  resetDb();
  db.user.findUnique = async (a: any) => {
    const jti = a.select?.revokedTokens?.where?.jti;
    return { role: 'COACH', tokenVersion: 0, ...(jti !== undefined ? { revokedTokens: revoked.has(jti) ? [{ jti }] : [] } : {}) };
  };
}

async function post(base: string, path: string, token?: string) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json() };
}

async function main() {
  // Every new token carries its own jti, so one session can be revoked alone.
  const a = decode(tokenFor('u1'));
  const b = decode(tokenFor('u1'));
  assert.equal(typeof a.jti, 'string');
  assert.ok((a.jti as string).length >= 16);
  assert.notEqual(a.jti, b.jti);

  // requireAuth: a revoked jti is the same 401 as a stale tokenVersion.
  const token = tokenFor('u1');
  const { jti } = decode(token);
  world(new Set([jti as string]));
  let res = fakeRes();
  let nexts = 0;
  await requireAuth({ headers: { authorization: `Bearer ${token}` } } as any, res, () => { nexts++; });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Session expired. Sign in again.' });
  assert.equal(nexts, 0);
  assert.equal(callsFor('user', 'findUnique').length, 1, 'one read checks tokenVersion and the jti');
  assert.equal(callsFor('user', 'findUnique')[0][0].select.revokedTokens.where.jti, jti);

  // optionalAuth: a revoked token just means unauthenticated.
  world(new Set([jti as string]));
  const optReq: any = { headers: { authorization: `Bearer ${token}` } };
  await optionalAuth(optReq, fakeRes(), () => { nexts++; });
  assert.equal(nexts, 1);
  assert.equal(optReq.user, undefined);

  // Not revoked: through.
  world();
  res = fakeRes();
  const okReq: any = { headers: { authorization: `Bearer ${token}` } };
  await requireAuth(okReq, res, () => { nexts++; });
  assert.equal(nexts, 2);
  assert.equal(okReq.user.userId, 'u1');

  // The memo: a row read without the jti filter is never taken as "not
  // revoked"; a row read with it serves later plain loadUser calls.
  world();
  await withRequestStore(async () => {
    await loadUser('u1');
    const u = await loadAuthUser('u1', 'j1');
    assert.deepEqual(u?.revokedTokens, []);
    assert.equal(callsFor('user', 'findUnique').length, 2, 'the jti read is its own query');
  });
  world();
  await withRequestStore(async () => {
    await loadAuthUser('u1', 'j1');
    await loadUser('u1');
    await loadAuthUser('u1', 'j1');
    assert.equal(callsFor('user', 'findUnique').length, 1, 'later reads of the same user are memo hits');
    await loadAuthUser('u1', 'j2');
    assert.equal(callsFor('user', 'findUnique').length, 2, 'another jti is never answered from j1');
  });

  await withServer(async (base) => {
    world();
    assert.deepEqual(await post(base, '/api/v1/auth/logout'), { status: 401, body: { error: 'Authentication required.' } });
    assert.equal((await post(base, '/api/v1/auth/logout-all')).status, 401);

    // Logout stores this token's jti until the token would have expired anyway.
    const t = tokenFor('u1');
    const { jti: tj, exp } = decode(t);
    world();
    db.revokedToken.createMany = async () => ({ count: 1 });
    db.revokedToken.deleteMany = async () => { throw new Error('cleanup is best-effort'); };
    assert.deepEqual(await post(base, '/api/v1/auth/logout', t), { status: 200, body: { message: 'Logged out successfully.' } });
    const [args] = callsFor('revokedToken', 'createMany')[0];
    assert.deepEqual(args, { data: [{ jti: tj, userId: 'u1', expiresAt: new Date(exp * 1000) }], skipDuplicates: true });
    assert.equal(callsFor('revokedToken', 'deleteMany').length, 1, 'expired rows are swept, and a failure there is ignored');

    // A token from before this release has no jti: it just runs out.
    world();
    const old = jwt.sign({ userId: 'u1', email: 'u1@example.test', role: 'COACH', tv: 0 }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    assert.equal((await post(base, '/api/v1/auth/logout', old)).status, 200);
    assert.equal(callsFor('revokedToken', 'createMany').length, 0);
    assert.equal(callsFor('user', 'update').length, 0, 'never a sign-out of every device');

    // Logout everywhere: one tokenVersion bump.
    world();
    db.user.update = async () => ({});
    assert.deepEqual(await post(base, '/api/v1/auth/logout-all', tokenFor('u1')), { status: 200, body: { message: 'Signed out of all devices.' } });
    assert.deepEqual(callsFor('user', 'update')[0][0], { where: { id: 'u1' }, data: { tokenVersion: { increment: 1 } }, select: { id: true } });
  });

  console.log('http.logout.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
