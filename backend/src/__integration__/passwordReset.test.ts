// 9.6.S on real Postgres: a password reset through the real route. It sets the
// password, ends other sessions, marks the address verified (only its owner
// gets the link), and drops any outside sign-in attached while the address was
// unverified. A verified account keeps its Google sign-in.
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { prisma, startApp, cleanup, call, RUN } from './harness';
import { hashResetToken } from '../lib/passwordReset';

async function main() {
  const app = await startApp();
  try {
    const make = async (key: string, verified: boolean) => {
      const token = `${RUN}-${key}-reset-token`;
      const user = await prisma.user.create({
        data: {
          email: `${RUN}-${key}@integration.test`, passwordHash: null, firstName: key, lastName: 'Reset',
          emailVerifiedAt: verified ? new Date('2026-01-01') : null,
          passwordResetTokenHash: hashResetToken(token), passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          identities: { create: { provider: 'GOOGLE', providerSubject: `${RUN}-${key}-sub`, email: `${RUN}-${key}@integration.test`, emailVerified: true } },
        },
      });
      return { id: user.id, email: user.email, token };
    };
    const reset = (token: string, password: string) => call(app.base, 'POST', '/api/v1/auth/reset-password', undefined, { token, password });
    const PASSWORD = 'a brand new password';

    // An unverified, Google-only account sets its first password.
    const fresh = await make('unverified', false);
    assert.equal((await reset(fresh.token, 'short')).status, 400, 'too short: refused');
    assert.equal(await prisma.userIdentity.count({ where: { userId: fresh.id } }), 1, 'a refused reset removes nothing');
    const ok = await reset(fresh.token, PASSWORD);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: fresh.id }, include: { identities: true } });
    assert.ok(after.passwordHash && (await bcrypt.compare(PASSWORD, after.passwordHash)), 'the password is set');
    assert.ok(after.emailVerifiedAt, 'the address is verified by the reset');
    assert.equal(after.identities.length, 0, 'a sign-in attached before the address was verified is gone');
    assert.equal(after.passwordResetTokenHash, null);
    assert.equal(after.tokenVersion, 1, 'other sessions end');
    // The link works once.
    assert.equal((await reset(fresh.token, PASSWORD)).status, 400);
    // And the new password signs in.
    assert.equal((await call(app.base, 'POST', '/api/v1/auth/login', undefined, { email: fresh.email, password: PASSWORD })).status, 200);

    // A verified account keeps its Google sign-in and its original verification date.
    const kept = await make('verified', true);
    assert.equal((await reset(kept.token, PASSWORD)).status, 200);
    const keptAfter = await prisma.user.findUniqueOrThrow({ where: { id: kept.id }, include: { identities: true } });
    assert.equal(keptAfter.identities.length, 1);
    assert.equal(keptAfter.emailVerifiedAt?.toISOString(), new Date('2026-01-01').toISOString());

    // An unknown or expired link changes nothing.
    assert.equal((await reset('no-such-token', PASSWORD)).status, 400);

    console.log('passwordReset: all tests passed');
  } finally {
    await app.close();
    await cleanup();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
