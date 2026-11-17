// 9.6.S3 on real Postgres, through the real routes: Sign in with Google from a
// first visit to a returning one, the sign-up form's refusals, single-use
// nonces, and linking conflicts. Google's keys are swapped for a local key set
// (setGoogleKeysForTests); everything else is the production path.
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import { prisma, startApp, makeUser, cleanup, call, RUN } from './harness';
import { setGoogleKeysForTests } from '../services/socialAuth.service';
import { signSignupToken } from '../lib/socialTokens';

const AUD = 'it-web-client-id';
process.env.GOOGLE_WEB_CLIENT_ID = AUD;

async function main() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  setGoogleKeysForTests(createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] }));
  const google = (nonce: string, sub: string, claims: JWTPayload) =>
    new SignJWT({ nonce, email_verified: true, given_name: 'Goo', family_name: 'Gle', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('https://accounts.google.com')
      .setAudience(AUD).setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(privateKey);

  const app = await startApp();
  try {
    const nonceFor = async (purpose: string, token?: string) => (await call(app.base, 'GET', `/api/v1/auth/nonce?purpose=${purpose}`, token)).body.nonce as string;
    const signIn = async (sub: string, claims: JWTPayload) => {
      const nonce = await nonceFor('signin');
      const idToken = await google(nonce, sub, claims);
      return { nonce, idToken, res: await call(app.base, 'POST', '/api/v1/auth/google', undefined, { idToken, nonce }) };
    };

    // Anonymous: a sign-in nonce only; the profile route needs a session.
    assert.equal((await call(app.base, 'GET', '/api/v1/auth/nonce?purpose=link')).status, 401);
    assert.equal((await call(app.base, 'POST', '/api/v1/profile/identities/google', undefined, {})).status, 401);
    assert.equal((await call(app.base, 'POST', '/api/v1/auth/google', undefined, {})).status, 401, 'no token, no nonce');

    // A new person: no account yet, a sign-up token instead.
    const email = `${RUN}-new@gmail.com`;
    const first = await signIn(`${RUN}-sub-new`, { email });
    assert.equal(first.res.status, 200, JSON.stringify(first.res.body));
    assert.equal(first.res.body.needsSignup, true);
    assert.equal(first.res.body.token, undefined);
    assert.equal(await prisma.user.count({ where: { email } }), 0, 'nothing created before the Terms');
    const { signupToken } = first.res.body;

    // The same nonce and token again: single use.
    const replay = await call(app.base, 'POST', '/api/v1/auth/google', undefined, { idToken: first.idToken, nonce: first.nonce });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.code, 'SOCIAL_TOKEN_REJECTED');

    // The sign-up form.
    const complete = (body: Record<string, unknown>) => call(app.base, 'POST', '/api/v1/auth/social/complete', undefined, { firstName: 'Goo', lastName: 'Gle', signupIntent: 'COACH', ...body });
    const noTerms = await complete({ signupToken, acceptTerms: false });
    assert.equal(noTerms.status, 400);
    assert.match(noTerms.body.error, /13 or older/);
    const expired = signSignupToken(process.env.JWT_SECRET as string, { provider: 'GOOGLE', subject: `${RUN}-sub-x`, email: `${RUN}-x@gmail.com`, emailVerified: true, givenName: null, familyName: null }, Date.now() - 11 * 60 * 1000);
    const late = await complete({ signupToken: expired, acceptTerms: true });
    assert.equal(late.status, 401);
    assert.equal(late.body.code, 'SIGNUP_TOKEN_REJECTED');
    assert.equal(await prisma.user.count({ where: { email: { in: [email, `${RUN}-x@gmail.com`] } } }), 0);

    const done = await complete({ signupToken, acceptTerms: true });
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal(done.body.user.email, email);
    assert.equal(done.body.user.emailVerified, true);
    assert.equal(done.body.user.termsRequired, false);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email }, include: { identities: true } });
    assert.equal(stored.passwordHash, null);
    assert.equal(stored.identities.length, 1);
    assert.equal(stored.identities[0].providerSubject, `${RUN}-sub-new`);
    // The token can't make a second account.
    const again = await complete({ signupToken, acceptTerms: true });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'ACCOUNT_EXISTS');

    // /auth/me says how this account signs in, and never returns the hash.
    const me = await call(app.base, 'GET', '/api/v1/auth/me', done.body.token);
    assert.equal(me.body.hasPassword, false);
    assert.deepEqual(me.body.signInMethods, ['google']);
    assert.ok(!('passwordHash' in me.body) && !('identities' in me.body));
    // A password login for it fails like any wrong password.
    assert.equal((await call(app.base, 'POST', '/api/v1/auth/login', undefined, { email, password: 'anything at all' })).status, 401);

    // Coming back: straight in, by Google's id, even if Google now reports another address.
    const back = await signIn(`${RUN}-sub-new`, { email: `${RUN}-renamed@gmail.com` });
    assert.equal(back.res.status, 200);
    assert.equal(back.res.body.user.id, stored.id);
    assert.ok((await prisma.userIdentity.findFirstOrThrow({ where: { userId: stored.id } })).lastUsedAt);

    // An existing password account with a non-Google address: never auto-linked.
    const coach = await makeUser('coach'); // <run>-coach@integration.test, verified
    const COACH_PASSWORD = 'coach long password';
    await prisma.user.update({ where: { id: coach.id }, data: { passwordHash: await bcrypt.hash(COACH_PASSWORD, 4) } });
    const clash = await signIn(`${RUN}-sub-coach`, { email: coach.email });
    assert.equal(clash.res.status, 409);
    assert.equal(clash.res.body.code, 'LINK_REQUIRED');
    assert.equal(await prisma.userIdentity.count({ where: { userId: coach.id } }), 0);

    // So the coach connects Google from Profile.
    const link = async (token: string, userNonceToken: string, sub: string, password: unknown = COACH_PASSWORD) => {
      const nonce = await nonceFor('link', userNonceToken);
      return call(app.base, 'POST', '/api/v1/profile/identities/google', token, { idToken: await google(nonce, sub, { email: coach.email }), nonce, password });
    };
    // A session without the password cannot add a way to sign in.
    assert.equal((await link(coach.token, coach.token, `${RUN}-sub-coach`, null)).status, 400);
    const wrong = await link(coach.token, coach.token, `${RUN}-sub-coach`, 'not the password');
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, 'WRONG_PASSWORD');
    assert.equal(await prisma.userIdentity.count({ where: { userId: coach.id } }), 0);
    // A Google account that already belongs to someone else: refused.
    const taken = await link(coach.token, coach.token, `${RUN}-sub-new`);
    assert.equal(taken.status, 409);
    assert.equal(taken.body.code, 'IDENTITY_IN_USE');
    // A link nonce issued to another signed-in user: refused.
    assert.equal((await link(coach.token, done.body.token, `${RUN}-sub-coach`)).status, 403);
    // Their own: linked, and now both ways of signing in.
    const linked = await link(coach.token, coach.token, `${RUN}-sub-coach`);
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    assert.deepEqual(linked.body.signInMethods, ['password', 'google']);
    assert.equal((await signIn(`${RUN}-sub-coach`, { email: coach.email })).res.body.user.id, coach.id, 'Google now signs the coach in');
    // A second, different Google account on the same VolleyVision account: refused.
    const second = await link(coach.token, coach.token, `${RUN}-sub-coach-2`);
    assert.equal(second.status, 409);
    assert.equal(second.body.code, 'IDENTITY_EXISTS');
    assert.equal((await call(app.base, 'POST', '/api/v1/profile/identities/apple', coach.token, {})).status, 404);

    // An existing verified gmail account auto-links on first Google sign-in.
    const gmail = `${RUN}-auto@gmail.com`;
    const owner = await prisma.user.create({ data: { email: gmail, passwordHash: 'x', firstName: 'Auto', lastName: 'Link', emailVerifiedAt: new Date() } });
    const auto = await signIn(`${RUN}-sub-auto`, { email: gmail });
    assert.equal(auto.res.status, 200, JSON.stringify(auto.res.body));
    assert.equal(auto.res.body.user.id, owner.id);
    // But not while our own copy of the address is unverified.
    const unverified = await prisma.user.create({ data: { email: `${RUN}-unv@gmail.com`, passwordHash: 'x', firstName: 'Un', lastName: 'Verified' } });
    const held = await signIn(`${RUN}-sub-unv`, { email: unverified.email });
    assert.equal(held.res.status, 409);
    assert.equal(held.res.body.code, 'LINK_REQUIRED');

    // 9.6.S5: disconnect Google. Needs the password; afterwards Google no longer signs the coach in.
    const unlink = (token: string, password?: unknown) => call(app.base, 'DELETE', '/api/v1/profile/identities/google', token, { password });
    assert.equal((await call(app.base, 'DELETE', '/api/v1/profile/identities/google', undefined, {})).status, 401, 'anonymous unlink');
    assert.equal((await unlink(coach.token)).status, 400, 'no password');
    assert.equal((await unlink(coach.token, 'not the password')).body.code, 'WRONG_PASSWORD');
    assert.equal(await prisma.userIdentity.count({ where: { userId: coach.id } }), 1);
    const unlinked = await unlink(coach.token, COACH_PASSWORD);
    assert.equal(unlinked.status, 200, JSON.stringify(unlinked.body));
    assert.deepEqual(unlinked.body.signInMethods, ['password']);
    assert.equal((await unlink(coach.token, COACH_PASSWORD)).status, 404, 'nothing left to remove');
    assert.equal((await signIn(`${RUN}-sub-coach`, { email: coach.email })).res.body.code, 'LINK_REQUIRED', 'Google no longer opens the account');
    // A Google-only account cannot remove its only way in.
    const locked = await unlink(done.body.token, 'anything');
    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, 'PASSWORD_REQUIRED');
    assert.equal(await prisma.userIdentity.count({ where: { userId: stored.id } }), 1);

    // 9.6.S5: deleting a Google-only account is confirmed with Google, not a password.
    const del = (body: Record<string, unknown>) => call(app.base, 'DELETE', '/api/v1/profile', done.body.token, body);
    const noProof = await del({ password: 'anything' });
    assert.equal(noProof.status, 400);
    assert.equal(noProof.body.code, 'GOOGLE_CONFIRMATION_REQUIRED');
    // A sign-in nonce cannot confirm a deletion.
    const sn = await nonceFor('signin');
    assert.equal((await del({ provider: 'google', nonce: sn, idToken: await google(sn, `${RUN}-sub-new`, { email }) })).status, 403);
    // A delete nonce issued to someone else cannot either.
    const cn = await nonceFor('delete', coach.token);
    assert.equal((await del({ provider: 'google', nonce: cn, idToken: await google(cn, `${RUN}-sub-new`, { email }) })).status, 403);
    // The right nonce, but another Google account: refused, nonce spent, account intact.
    let dn = await nonceFor('delete', done.body.token);
    const other = await del({ provider: 'google', nonce: dn, idToken: await google(dn, `${RUN}-sub-coach`, { email: coach.email }) });
    assert.equal(other.status, 403);
    assert.equal(other.body.code, 'WRONG_GOOGLE_ACCOUNT');
    assert.equal(await prisma.user.count({ where: { id: stored.id } }), 1);
    // Their own Google account, freshly signed in: deleted, identity and all.
    dn = await nonceFor('delete', done.body.token);
    const gone = await del({ provider: 'google', nonce: dn, idToken: await google(dn, `${RUN}-sub-new`, { email }) });
    assert.equal(gone.status, 204, JSON.stringify(gone.body));
    assert.equal(await prisma.user.count({ where: { id: stored.id } }), 0);
    assert.equal(await prisma.userIdentity.count({ where: { providerSubject: `${RUN}-sub-new` } }), 0);
    // An account WITH a password still deletes with the password, as before (not exercised here: accountDeletion.test.ts).

    // Deleting the account takes its identities with it.
    await prisma.user.delete({ where: { id: owner.id } });
    assert.equal(await prisma.userIdentity.count({ where: { providerSubject: `${RUN}-sub-auto` } }), 0);

    console.log('social: all tests passed');
  } finally {
    setGoogleKeysForTests(null);
    await app.close();
    await cleanup();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
