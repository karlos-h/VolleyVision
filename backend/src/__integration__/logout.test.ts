// 9.6.0.2 on real Postgres: signing out kills that token (and only it),
// "sign out of all devices" kills every token, and an account's revoked rows
// go with the account.
import assert from 'node:assert/strict';
import { prisma, startApp, makeUser, cleanup, call } from './harness';
import jwt from 'jsonwebtoken';
import { generateToken, revokeToken, AuthPayload } from '../services/auth.service';

async function main() {
  const app = await startApp();
  try {
    const u = await makeUser('logout');
    const me = (token: string) => call(app.base, 'GET', '/api/v1/auth/me', token);
    const other = generateToken({ userId: u.id, email: u.email, role: 'COACH', tv: 0 });

    // Sign out: that token is dead, the same user's other session isn't.
    assert.equal((await me(u.token)).status, 200);
    const out = await call(app.base, 'POST', '/api/v1/auth/logout', u.token);
    assert.deepEqual(out, { status: 200, body: { message: 'Logged out successfully.' } });
    assert.deepEqual(await me(u.token), { status: 401, body: { error: 'Session expired. Sign in again.' } });
    assert.equal((await me(other)).status, 200, 'another device stays signed in');

    // A second sign-out with the same token: refused as dead, never a 500.
    assert.equal((await call(app.base, 'POST', '/api/v1/auth/logout', u.token)).status, 401);
    // A double tap can get both requests past requireAuth before either
    // writes: the second insert is a no-op, not a unique-key 500.
    const twice = jwt.decode(generateToken({ userId: u.id, email: u.email, role: 'COACH', tv: 0 })) as AuthPayload;
    await revokeToken(twice);
    await revokeToken(twice);
    assert.equal(await prisma.revokedToken.count({ where: { userId: u.id } }), 2);

    // Expired rows are swept by the next sign-out.
    await prisma.revokedToken.create({ data: { jti: `${u.id}-old`, userId: u.id, expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call(app.base, 'POST', '/api/v1/auth/logout', other)).status, 200);
    assert.equal(await prisma.revokedToken.count({ where: { jti: `${u.id}-old` } }), 0);

    // Sign out of all devices: two separately issued tokens both die.
    const v = await makeUser('logout-all');
    const phone = generateToken({ userId: v.id, email: v.email, role: 'COACH', tv: 0 });
    assert.equal((await me(phone)).status, 200);
    const all = await call(app.base, 'POST', '/api/v1/auth/logout-all', v.token);
    assert.deepEqual(all, { status: 200, body: { message: 'Signed out of all devices.' } });
    for (const t of [v.token, phone]) assert.deepEqual(await me(t), { status: 401, body: { error: 'Session expired. Sign in again.' } });

    // Deleting the account removes its revoked rows.
    await prisma.user.delete({ where: { id: u.id } });
    assert.equal(await prisma.revokedToken.count({ where: { userId: u.id } }), 0);
  } finally {
    await app.close();
    await cleanup();
  }
  console.log('logout.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
