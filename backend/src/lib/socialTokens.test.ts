// 9.6.S2: nonces and sign-up tokens are their own kinds of token.
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { NONCE_TTL_SECONDS, SIGNUP_TOKEN_TTL_SECONDS, isNoncePurpose, signNonce, signSignupToken, verifyNonce, verifySignupToken } from './socialTokens';

const SECRET = 'test-secret';
const NOW = 1_800_000_000_000;
const claims = { provider: 'GOOGLE' as const, subject: 'g-123', email: 'a@gmail.com', emailVerified: true, givenName: 'Ana', familyName: null };

// Purposes.
assert.ok(isNoncePurpose('signin') && isNoncePurpose('link') && isNoncePurpose('delete'));
assert.ok(!isNoncePurpose('admin') && !isNoncePurpose(undefined) && !isNoncePurpose(['signin']));

// Nonce: happy path, unique jti, right expiry.
const n = signNonce(SECRET, 'signin', NOW);
const ok = verifyNonce(n, SECRET, 'signin', NOW);
assert.ok(ok.ok);
assert.equal(ok.value.purpose, 'signin');
assert.equal(ok.value.expiresAt.getTime(), NOW + NONCE_TTL_SECONDS * 1000);
const n2 = verifyNonce(signNonce(SECRET, 'signin', NOW), SECRET, 'signin', NOW);
assert.ok(n2.ok && n2.value.jti !== ok.value.jti, 'every nonce has its own jti');

// A sign-in nonce cannot confirm a deletion, and the reverse.
assert.deepEqual(verifyNonce(n, SECRET, 'delete', NOW), { ok: false, reason: 'wrong-purpose' });
assert.deepEqual(verifyNonce(signNonce(SECRET, 'delete', NOW), SECRET, 'signin', NOW), { ok: false, reason: 'wrong-purpose' });

// Expired, missing, tampered, another secret.
assert.deepEqual(verifyNonce(n, SECRET, 'signin', NOW + (NONCE_TTL_SECONDS + 1) * 1000), { ok: false, reason: 'expired' });
assert.equal(verifyNonce(n, SECRET, 'signin', NOW + (NONCE_TTL_SECONDS - 1) * 1000).ok, true);
for (const bad of [undefined, null, '', 42, ['x']]) assert.deepEqual(verifyNonce(bad, SECRET, 'signin', NOW), { ok: false, reason: 'missing' });
assert.deepEqual(verifyNonce(n.slice(0, -2) + 'xx', SECRET, 'signin', NOW), { ok: false, reason: 'invalid' });
assert.deepEqual(verifyNonce(n, 'other-secret', 'signin', NOW), { ok: false, reason: 'invalid' });

// Sign-up token: round trip and expiry.
const s = signSignupToken(SECRET, claims, NOW);
const sv = verifySignupToken(s, SECRET, NOW);
assert.ok(sv.ok);
const { jti: _jti, expiresAt, ...carried } = sv.value;
assert.deepEqual(carried, claims);
assert.equal(expiresAt.getTime(), NOW + SIGNUP_TOKEN_TTL_SECONDS * 1000);
assert.deepEqual(verifySignupToken(s, SECRET, NOW + (SIGNUP_TOKEN_TTL_SECONDS + 1) * 1000), { ok: false, reason: 'expired' });

// The kinds do not cross: each has its own key, so the signature already fails.
assert.deepEqual(verifySignupToken(n, SECRET, NOW), { ok: false, reason: 'invalid' });
assert.deepEqual(verifyNonce(s, SECRET, 'signin', NOW), { ok: false, reason: 'invalid' });
// A session token (signed with JWT_SECRET itself) is neither.
const session = jwt.sign({ userId: 'u1', email: 'a@b.c', role: 'COACH', tv: 0, jti: 'j', iat: NOW / 1000, exp: NOW / 1000 + 600 }, SECRET);
assert.deepEqual(verifyNonce(session, SECRET, 'signin', NOW), { ok: false, reason: 'invalid' });
assert.deepEqual(verifySignupToken(session, SECRET, NOW), { ok: false, reason: 'invalid' });
// Nor does a token forged with JWT_SECRET that merely claims typ: nonce.
const forged = jwt.sign({ typ: 'nonce', purpose: 'delete', jti: 'j', iat: NOW / 1000, exp: NOW / 1000 + 600 }, SECRET);
assert.deepEqual(verifyNonce(forged, SECRET, 'delete', NOW), { ok: false, reason: 'invalid' });
// alg: none is refused.
const none = jwt.sign({ typ: 'nonce', purpose: 'signin', jti: 'j', exp: NOW / 1000 + 600 }, '', { algorithm: 'none' as jwt.Algorithm });
assert.deepEqual(verifyNonce(none, SECRET, 'signin', NOW), { ok: false, reason: 'invalid' });

console.log('socialTokens.test.ts passed');
