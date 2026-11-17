// 9.6.S3: every branch of Sign in with Google: known identity, auto-link,
// LINK_REQUIRED, first-time sign-up, completing it, and linking from Profile.
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import { db, resetDb } from '../testing/installFakePrisma';
import '../testing/testEnv';
import { issueNonce } from '../services/socialAuth.service';
import { completeSocialSignup, linkGoogleIdentity, signInWithGoogle } from '../services/socialSignIn.service';
import { canAutoLink, googleIsAuthoritative } from '../lib/socialLink';
import { signSignupToken, verifySignupToken } from '../lib/socialTokens';
import { resetPassword, verifyToken } from '../services/auth.service';

const SECRET = process.env.JWT_SECRET as string;
const AUD = 'web-client-id';
const unique = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

type Row = Record<string, any>;
const userRow = (over: Row = {}): Row => ({
  id: 'u1', email: 'ana@gmail.com', firstName: 'Ana', lastName: 'Tui', role: 'COACH', profileImage: null, signupIntent: null,
  emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: 'x', tokenVersion: 4, ...over,
});

async function failure(fn: () => Promise<unknown>): Promise<{ status: number; code?: string }> {
  try { await fn(); } catch (err) { return { status: (err as { statusCode: number }).statusCode, code: (err as { code?: string }).code }; }
  throw new Error('expected a failure');
}

async function main() {
  // The auto-link rule on its own.
  assert.equal(googleIsAuthoritative({ email: 'a@gmail.com', hostedDomain: null }), true);
  assert.equal(googleIsAuthoritative({ email: 'a@school.nz', hostedDomain: 'school.nz' }), true);
  assert.equal(googleIsAuthoritative({ email: 'a@outlook.com', hostedDomain: null }), false);
  assert.equal(googleIsAuthoritative({ email: 'a@notgmail.com', hostedDomain: null }), false);
  assert.equal(googleIsAuthoritative({ email: null, hostedDomain: 'x.nz' }), false);
  const verifiedAccount = { emailVerifiedAt: new Date() };
  assert.equal(canAutoLink({ email: 'a@gmail.com', emailVerified: true, hostedDomain: null }, verifiedAccount), true);
  assert.equal(canAutoLink({ email: 'a@gmail.com', emailVerified: false, hostedDomain: null }, verifiedAccount), false, 'Google has not verified it');
  assert.equal(canAutoLink({ email: 'a@gmail.com', emailVerified: true, hostedDomain: null }, { emailVerifiedAt: null }), false, 'we never verified it');
  assert.equal(canAutoLink({ email: 'a@outlook.com', emailVerified: true, hostedDomain: null }, verifiedAccount), false, 'Google is not the authority');

  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const deps = { keys: createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] }), audiences: [AUD] };
  const google = (nonce: string, claims: JWTPayload = {}, sub = 'g-1') =>
    new SignJWT({ nonce, email: 'ana@gmail.com', email_verified: true, given_name: 'Ana', family_name: 'Tui', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('https://accounts.google.com')
      .setAudience(AUD).setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(privateKey);

  let audits: Row[] = [];
  const world = () => {
    resetDb();
    audits = [];
    db.revokedToken.create = async (a: Row) => a.data;
    db.revokedToken.deleteMany = async () => ({ count: 0 });
    db.auditLog.create = async (a: Row) => { audits.push(a.data); return a.data; };
  };
  const attempt = async (claims: JWTPayload = {}, sub = 'g-1') => {
    const { nonce } = issueNonce('signin');
    return signInWithGoogle({ idToken: await google(nonce, claims, sub), nonce }, deps);
  };
  const noSecrets = () => {
    const text = JSON.stringify(audits);
    assert.ok(!text.includes('ana@') && !text.includes('eyJ'), 'no emails or tokens in audit details');
  };

  // 1. Known identity: a session for that account, found by Google's id, not by email.
  world();
  let updated: Row | null = null;
  db.userIdentity.findUnique = async (a: Row) => {
    assert.deepEqual(a.where, { provider_providerSubject: { provider: 'GOOGLE', providerSubject: 'g-1' } });
    return { id: 'i1', user: userRow({ email: 'old-address@example.com' }) };
  };
  db.userIdentity.update = async (a: Row) => { updated = a; return { id: 'i1' }; };
  db.user.findUnique = async () => { throw new Error('a known identity must not be looked up by email'); };
  const known = (await attempt()) as Row;
  assert.equal(known.user.id, 'u1');
  assert.equal(known.user.email, 'old-address@example.com', 'the account, whatever Google now calls the address');
  assert.equal(verifyToken(known.token).tv, 4);
  assert.ok(updated && (updated as Row).data.lastUsedAt instanceof Date);
  assert.deepEqual(audits.map((a) => a.action), ['SOCIAL_SIGN_IN']);
  noSecrets();

  // 2a. Same-email account, safe to auto-link: identity created, signed in.
  world();
  let created: Row | null = null;
  db.userIdentity.findUnique = async () => null;
  db.user.findUnique = async (a: Row) => (a.where.email === 'ana@gmail.com' ? userRow() : null);
  db.userIdentity.create = async (a: Row) => { created = a.data; return { id: 'i2' }; };
  const linked = (await attempt()) as Row;
  assert.equal(linked.user.id, 'u1');
  assert.deepEqual({ ...(created as unknown as Row), lastUsedAt: null }, { userId: 'u1', provider: 'GOOGLE', providerSubject: 'g-1', email: 'ana@gmail.com', emailVerified: true, lastUsedAt: null });
  assert.deepEqual(audits.map((a) => a.action), ['IDENTITY_LINKED', 'SOCIAL_SIGN_IN']);
  noSecrets();

  // 2b. Same-email account, NOT safe: 409 LINK_REQUIRED and nothing is written.
  const refuseLink = async (why: string, claims: JWTPayload, account: Row) => {
    world();
    db.userIdentity.findUnique = async () => null;
    db.user.findUnique = async () => account;
    db.userIdentity.create = async () => { throw new Error(`must not link: ${why}`); };
    assert.deepEqual(await failure(() => attempt(claims)), { status: 409, code: 'LINK_REQUIRED' }, why);
    assert.equal(audits.length, 0);
  };
  await refuseLink('Google has not verified the address', { email_verified: false }, userRow());
  await refuseLink('our account never verified the address', {}, userRow({ emailVerifiedAt: null }));
  await refuseLink('not a gmail or Workspace address', { email: 'ana@outlook.com' }, userRow({ email: 'ana@outlook.com' }));
  // The account already has another Google identity (unique user + provider).
  world();
  db.userIdentity.findUnique = async () => null;
  db.user.findUnique = async () => userRow();
  db.userIdentity.create = async () => { throw unique(); };
  assert.deepEqual(await failure(() => attempt({}, 'g-other')), { status: 409, code: 'LINK_REQUIRED' });
  // A Workspace address auto-links (hd makes Google the authority).
  world();
  db.userIdentity.findUnique = async () => null;
  db.user.findUnique = async () => userRow({ email: 'ana@school.nz' });
  db.userIdentity.create = async () => ({ id: 'i3' });
  assert.equal(((await attempt({ email: 'ana@school.nz', hd: 'school.nz' })) as Row).user.id, 'u1');

  // 3. New person: no account is created; a sign-up token carries what Google vouched for.
  world();
  db.userIdentity.findUnique = async () => null;
  db.user.findUnique = async () => null;
  db.user.create = async () => { throw new Error('no account before the Terms are accepted'); };
  const fresh = (await attempt()) as Row;
  assert.equal(fresh.needsSignup, true);
  assert.equal(fresh.token, undefined, 'not signed in yet');
  assert.deepEqual(fresh.suggested, { firstName: 'Ana', lastName: 'Tui', email: 'ana@gmail.com' });
  const carried = verifySignupToken(fresh.signupToken, SECRET);
  assert.ok(carried.ok && carried.value.subject === 'g-1' && carried.value.emailVerified === true);
  assert.throws(() => verifyToken(fresh.signupToken), /Invalid or expired token/, 'a sign-up token is not a session');
  // A non-Google mailbox: Google saying "verified" is not enough, we send our own email.
  const outlook = (await attempt({ email: 'ana@outlook.com' }, 'g-out')) as Row;
  const outlookClaims = verifySignupToken(outlook.signupToken, SECRET);
  assert.ok(outlookClaims.ok && outlookClaims.value.emailVerified === false);
  // Google shared no email: nothing to build an account on.
  assert.equal((await failure(() => attempt({ email: undefined }))).status, 400);

  // Completing the sign-up.
  const complete = (over: Row = {}) => completeSocialSignup({ signupToken: fresh.signupToken, acceptTerms: true, firstName: ' Ana ', lastName: 'Tui', signupIntent: 'PLAYER', ...over });
  world();
  let newUser: Row | null = null;
  db.user.create = async (a: Row) => { newUser = a.data; return userRow({ id: 'u9', tokenVersion: 0 }); };
  const done = await complete();
  const made = newUser as unknown as Row;
  assert.equal(done.user.id, 'u9');
  assert.equal(made.passwordHash, null, 'no password');
  assert.equal(made.firstName, 'Ana');
  assert.equal(made.signupIntent, 'PLAYER');
  assert.ok(made.emailVerifiedAt instanceof Date, 'Google verified the address');
  assert.equal(made.emailVerificationTokenHash, undefined, 'so no verification email');
  assert.ok(made.termsAcceptedAt instanceof Date && typeof made.termsVersion === 'string');
  assert.deepEqual({ ...made.identities.create, lastUsedAt: null }, { provider: 'GOOGLE', providerSubject: 'g-1', email: 'ana@gmail.com', emailVerified: true, lastUsedAt: null });
  assert.deepEqual(audits.map((a) => a.action), ['IDENTITY_CREATED']);
  noSecrets();

  // Refusals: Terms not accepted (exactly true is required), names, bad or expired token.
  for (const acceptTerms of [false, undefined, 'true', 1]) {
    world();
    db.user.create = async () => { throw new Error('must not create'); };
    assert.equal((await failure(() => complete({ acceptTerms }))).status, 400, `acceptTerms ${String(acceptTerms)}`);
  }
  assert.equal((await failure(() => complete({ firstName: '   ' }))).status, 400);
  assert.equal((await failure(() => complete({ lastName: 'x'.repeat(101) }))).status, 400);
  assert.deepEqual(await failure(() => complete({ signupToken: 'nope' })), { status: 401, code: 'SIGNUP_TOKEN_REJECTED' });
  assert.deepEqual(await failure(() => complete({ signupToken: issueNonce('signin').nonce })), { status: 401, code: 'SIGNUP_TOKEN_REJECTED' }, 'a nonce is not a sign-up token');
  const stale = signSignupToken(SECRET, { provider: 'GOOGLE', subject: 'g-1', email: 'ana@gmail.com', emailVerified: true, givenName: null, familyName: null }, Date.now() - 11 * 60 * 1000);
  assert.deepEqual(await failure(() => complete({ signupToken: stale })), { status: 401, code: 'SIGNUP_TOKEN_REJECTED' }, 'expired');
  // Used twice, or the email was taken meanwhile: the database refuses, we say 409.
  world();
  db.user.create = async () => { throw unique(); };
  assert.deepEqual(await failure(() => complete()), { status: 409, code: 'ACCOUNT_EXISTS' });
  // An address Google had NOT verified gets our own verification email.
  world();
  db.user.create = async (a: Row) => { newUser = a.data; return userRow({ id: 'u10', emailVerifiedAt: null }); };
  const unverified = signSignupToken(SECRET, { provider: 'GOOGLE', subject: 'g-2', email: 'x@gmail.com', emailVerified: false, givenName: null, familyName: null });
  await complete({ signupToken: unverified });
  assert.equal((newUser as unknown as Row).emailVerifiedAt, undefined);
  assert.equal(typeof (newUser as unknown as Row).emailVerificationTokenHash, 'string');

  // Linking from Profile.
  const PASSWORD = 'correct horse battery';
  const hash = await bcrypt.hash(PASSWORD, 4);
  const link = async (userId: string, nonceFor: string | null, sub = 'g-1', password: unknown = PASSWORD) => {
    const nonce = nonceFor ? issueNonce('link', nonceFor).nonce : issueNonce('signin').nonce;
    return linkGoogleIdentity(userId, { idToken: await google(nonce, {}, sub), nonce, password }, deps);
  };
  const me = (passwordHash: string | null = hash) => ({ ...userRow(), createdAt: new Date(), passwordHash, identities: [{ provider: 'GOOGLE' }] });
  world();
  db.userIdentity.findUnique = async () => null;
  db.userIdentity.create = async (a: Row) => { created = a.data; return { id: 'i5' }; };
  db.user.findUnique = async () => me();
  assert.deepEqual(await link('u1', 'u1'), { linked: true, signInMethods: ['password', 'google'] });
  assert.equal((created as unknown as Row).userId, 'u1');
  assert.deepEqual(audits.map((a) => a.action), ['IDENTITY_LINKED']);
  // Already linked to this same account: fine, nothing new written.
  world();
  db.userIdentity.findUnique = async () => ({ userId: 'u1' });
  db.userIdentity.create = async () => { throw new Error('already linked'); };
  db.user.findUnique = async () => me();
  assert.equal((await link('u1', 'u1')).linked, true);
  assert.equal(audits.length, 0);
  // That Google account belongs to someone else.
  world();
  db.user.findUnique = async () => me();
  db.userIdentity.findUnique = async () => ({ userId: 'someone-else' });
  assert.deepEqual(await failure(() => link('u1', 'u1')), { status: 409, code: 'IDENTITY_IN_USE' });
  // This account already has a different Google account.
  world();
  db.user.findUnique = async () => me();
  db.userIdentity.findUnique = async () => null;
  db.userIdentity.create = async () => { throw unique(); };
  assert.deepEqual(await failure(() => link('u1', 'u1', 'g-2')), { status: 409, code: 'IDENTITY_EXISTS' });
  // A session alone is not enough: the account password is needed (a stolen token has none).
  world();
  db.user.findUnique = async () => me();
  db.userIdentity.findUnique = async () => { throw new Error('must be refused before the Google check'); };
  assert.equal((await failure(() => link('u1', 'u1', 'g-1', null))).status, 400, 'no password given');
  assert.deepEqual(await failure(() => link('u1', 'u1', 'g-1', 'wrong password')), { status: 403, code: 'WRONG_PASSWORD' });
  // A Google-only account has no password to ask for.
  world();
  db.user.findUnique = async () => me(null);
  db.userIdentity.findUnique = async () => ({ userId: 'u1' });
  assert.deepEqual(await link('u1', 'u1', 'g-1', null), { linked: true, signInMethods: ['google'] });

  // A link nonce issued to another account, or a sign-in nonce, cannot link.
  world();
  db.user.findUnique = async () => me();
  db.userIdentity.findUnique = async () => { throw new Error('must be refused before any lookup'); };
  assert.deepEqual(await failure(() => link('u1', 'u2')), { status: 401, code: 'SOCIAL_TOKEN_REJECTED' });
  assert.deepEqual(await failure(() => link('u1', null)), { status: 401, code: 'SOCIAL_TOKEN_REJECTED' });
  // And a link nonce cannot sign anyone in.
  const ln = issueNonce('link', 'u1').nonce;
  assert.deepEqual(await failure(async () => signInWithGoogle({ idToken: await google(ln), nonce: ln }, deps)), { status: 401, code: 'SOCIAL_TOKEN_REJECTED' });

  // Password reset on an account whose address we never verified drops any
  // outside sign-in attached to it; a verified account keeps its own.
  world();
  let dropped: Row | null = null;
  db.userIdentity.deleteMany = async (a: Row) => { dropped = a.where; return { count: 1 }; };
  db.user.updateMany = async () => ({ count: 1 });
  await resetPassword('reset-token', 'a new long password');
  assert.equal((dropped as unknown as Row).user.emailVerifiedAt, null, 'only for accounts we never verified');
  assert.ok((dropped as unknown as Row).user.passwordResetTokenHash, 'and only the account this reset link belongs to');

  console.log('socialSignIn.test.ts passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
