// 9.6.S2: GET /auth/nonce, single-use nonces, and the wall between session
// tokens, nonces and sign-up tokens.
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { db, resetDb } from '../testing/installFakePrisma';
import { withServer, tokenFor } from '../testing/http';
import { verifyToken } from '../services/auth.service';
import { issueNonce, googleAudiences, verifyGoogleSignIn } from '../services/socialAuth.service';
import { signNonce, signSignupToken, verifyNonce } from '../lib/socialTokens';

const SECRET = process.env.JWT_SECRET as string;
const AUD = 'web-client-id';

async function status(fn: () => Promise<unknown>): Promise<{ status: number; code?: string } | null> {
  try { await fn(); return null; } catch (err) { return { status: (err as { statusCode: number }).statusCode, code: (err as { code?: string }).code }; }
}

async function main() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] });
  const googleToken = (nonce: string, aud = AUD) =>
    new SignJWT({ nonce, email: 'ana@gmail.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('https://accounts.google.com')
      .setAudience(aud).setSubject('g-1').setIssuedAt().setExpirationTime('5m').sign(privateKey);

  // The route: public, validates purpose, returns a nonce of that purpose.
  resetDb();
  await withServer(async (base) => {
    for (const purpose of ['signin', 'link', 'delete'] as const) {
      const res = await fetch(`${base}/api/v1/auth/nonce?purpose=${purpose}`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { nonce: string; expiresIn: number };
      assert.equal(body.expiresIn, 300);
      assert.equal(verifyNonce(body.nonce, SECRET, purpose).ok, true);
    }
    for (const bad of ['', '?purpose=admin', '?purpose=signin&purpose=delete']) {
      assert.equal((await fetch(`${base}/api/v1/auth/nonce${bad}`)).status, 400, `purpose ${bad || '(none)'}`);
    }
    // A nonce is not a session: it opens nothing.
    const { nonce } = issueNonce('signin');
    assert.equal((await fetch(`${base}/api/v1/auth/me`, { headers: { authorization: `Bearer ${nonce}` } })).status, 401);
  });

  // The session check accepts session tokens only.
  assert.equal(verifyToken(tokenFor('u1')).userId, 'u1');
  const refuse = (token: string, why: string) => assert.throws(() => verifyToken(token), /Invalid or expired token/, why);
  refuse(issueNonce('signin').nonce, 'a nonce');
  refuse(signSignupToken(SECRET, { provider: 'GOOGLE', subject: 's', email: 'a@b.c', emailVerified: true, givenName: null, familyName: null }), 'a sign-up token');
  refuse(jwt.sign({ typ: 'nonce', purpose: 'signin', jti: 'j' }, SECRET, { expiresIn: 60 }), 'signed with the session key but no user');
  refuse(jwt.sign({ userId: 'u1', email: 'a@b.c', role: 'COACH', tv: 0, typ: 'signup' }, SECRET, { expiresIn: 60 }), 'a user plus a typ');
  refuse(jwt.sign({ userId: 'u1', email: 'a@b.c', role: 'COACH' }, SECRET, { expiresIn: 60 }), 'no token version');
  refuse(jwt.sign({ email: 'a@b.c', role: 'ADMIN', tv: 0 }, SECRET, { expiresIn: 60 }), 'no user id');
  refuse(jwt.sign({ userId: 'u1', email: 'a@b.c', role: 'COACH', tv: 0 }, SECRET, { expiresIn: 60, algorithm: 'HS512' }), 'another algorithm');
  // And a session token is not a nonce.
  assert.equal(verifyNonce(tokenFor('u1'), SECRET, 'signin').ok, false);

  // verifyGoogleSignIn: the happy path spends the nonce; a replay is refused.
  resetDb();
  const spent = new Set<string>();
  let sweeps = 0;
  db.revokedToken.deleteMany = async () => { sweeps++; return { count: 0 }; };
  db.revokedToken.create = async (a: { data: { jti: string; userId?: string; expiresAt: Date } }) => {
    if (spent.has(a.data.jti)) throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
    assert.equal(a.data.userId, undefined, 'a nonce row is tied to no account');
    assert.ok(a.data.expiresAt.getTime() > Date.now());
    spent.add(a.data.jti);
    return a.data;
  };
  const deps = { keys, audiences: [AUD] };
  const { nonce } = issueNonce('signin');
  const idToken = await googleToken(nonce);
  const identity = await verifyGoogleSignIn({ idToken, nonce, purpose: 'signin' }, deps);
  assert.equal(identity.subject, 'g-1');
  assert.equal(spent.size, 1);
  assert.equal(sweeps, 1, 'expired rows are swept after a successful sign-in');
  assert.deepEqual(await status(() => verifyGoogleSignIn({ idToken, nonce, purpose: 'signin' }, deps)), { status: 401, code: 'SOCIAL_TOKEN_REJECTED' }, 'replay');

  // Every refusal is the same 401, and none of them spends the nonce.
  const before = spent.size;
  const fresh = () => issueNonce('signin').nonce;
  const rejected = { status: 401, code: 'SOCIAL_TOKEN_REJECTED' };
  let nn = fresh();
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(fresh()), nonce: nn, purpose: 'signin' }, deps)), rejected, 'token answers another nonce');
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(nn), nonce: undefined, purpose: 'signin' }, deps)), rejected, 'no nonce sent');
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(nn), nonce: nn, purpose: 'delete' }, deps)), rejected, 'sign-in nonce used to delete');
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(nn, 'another-app'), nonce: nn, purpose: 'signin' }, deps)), rejected, 'wrong audience');
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: 'garbage', nonce: nn, purpose: 'signin' }, deps)), rejected, 'garbage token');
  const expired = signNonce(SECRET, 'signin', Date.now() - 6 * 60 * 1000);
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(expired), nonce: expired, purpose: 'signin' }, deps)), rejected, 'expired nonce');
  assert.equal(spent.size, before, 'a failed attempt does not burn the nonce');
  // The untouched nonce still works once.
  nn = fresh();
  assert.equal((await verifyGoogleSignIn({ idToken: await googleToken(nn), nonce: nn, purpose: 'signin' }, deps)).subject, 'g-1');

  // No client id configured: 503, not "any audience".
  nn = fresh();
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(nn), nonce: nn, purpose: 'signin' }, { keys, audiences: [] })), { status: 503, code: undefined });
  // Google's key server unreachable: 503 (an outage), still refused, nonce not spent.
  nn = fresh();
  const spentBefore = spent.size;
  const down = async () => { throw new TypeError('fetch failed'); };
  assert.deepEqual(await status(async () => verifyGoogleSignIn({ idToken: await googleToken(nn), nonce: nn, purpose: 'signin' }, { keys: down, audiences: [AUD] })), { status: 503, code: undefined });
  assert.equal(spent.size, spentBefore);

  assert.deepEqual(googleAudiences({ GOOGLE_WEB_CLIENT_ID: ' web ', GOOGLE_IOS_CLIENT_ID: '' }), ['web']);
  assert.deepEqual(googleAudiences({}), []);

  console.log('http.socialNonce.test.ts passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
