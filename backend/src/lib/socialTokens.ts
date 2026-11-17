// 9.6.S2: the two short-lived tokens of the social sign-in flow. Pure: no
// Express, no Prisma.
//   * nonce: handed to the client before it asks Google, echoed back inside
//     Google's ID token, so a stolen ID token can't be replayed to us.
//   * signupToken (S3): holds the provider's verified claims while a new person
//     fills in the sign-up form.
// Each is signed with its OWN key, derived from JWT_SECRET with a label, and
// carries a `typ`. A session token is signed with JWT_SECRET itself and has no
// `typ`, so none of the three can stand in for another: the signature fails
// before any claim is read.
import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const NONCE_TTL_SECONDS = 5 * 60;
export const SIGNUP_TOKEN_TTL_SECONDS = 10 * 60;

export const NONCE_PURPOSES = ['signin', 'link', 'delete'] as const;
export type NoncePurpose = (typeof NONCE_PURPOSES)[number];

export function isNoncePurpose(value: unknown): value is NoncePurpose {
  return typeof value === 'string' && (NONCE_PURPOSES as readonly string[]).includes(value);
}

type Label = 'vv-nonce' | 'vv-signup';

function derivedKey(secret: string, label: Label): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', secret, Buffer.alloc(0), label, 32));
}

export type Verified<T> = { ok: true; value: T } | { ok: false; reason: string };

function verifyTyped(token: unknown, secret: string, label: Label, typ: string, now: number): Verified<JwtPayload> {
  if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing' };
  try {
    const claims = jwt.verify(token, derivedKey(secret, label), {
      algorithms: ['HS256'],
      clockTimestamp: Math.floor(now / 1000),
    });
    if (typeof claims === 'string' || claims.typ !== typ) return { ok: false, reason: 'wrong-type' };
    if (typeof claims.exp !== 'number' || typeof claims.jti !== 'string' || !claims.jti) return { ok: false, reason: 'invalid' };
    return { ok: true, value: claims };
  } catch (err) {
    return { ok: false, reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }
}

function signTyped(payload: object, secret: string, label: Label, ttlSeconds: number, now: number): string {
  const iat = Math.floor(now / 1000);
  return jwt.sign(
    { ...payload, jti: crypto.randomBytes(16).toString('base64url'), iat, exp: iat + ttlSeconds },
    derivedKey(secret, label),
    { algorithm: 'HS256' },
  );
}

export function signNonce(secret: string, purpose: NoncePurpose, now: number = Date.now()): string {
  return signTyped({ typ: 'nonce', purpose }, secret, 'vv-nonce', NONCE_TTL_SECONDS, now);
}

export type NonceClaims = { jti: string; purpose: NoncePurpose; expiresAt: Date };

/** The nonce is ours, unexpired, and was issued for exactly this purpose. */
export function verifyNonce(nonce: unknown, secret: string, purpose: NoncePurpose, now: number = Date.now()): Verified<NonceClaims> {
  const v = verifyTyped(nonce, secret, 'vv-nonce', 'nonce', now);
  if (!v.ok) return v;
  // A sign-in nonce must never confirm a deletion (or the reverse).
  if (v.value.purpose !== purpose) return { ok: false, reason: 'wrong-purpose' };
  return { ok: true, value: { jti: v.value.jti as string, purpose, expiresAt: new Date((v.value.exp as number) * 1000) } };
}

/** What the provider vouched for, carried through the sign-up form (S3). */
export type SignupClaims = {
  provider: 'GOOGLE' | 'APPLE';
  subject: string;
  email: string;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
};

export function signSignupToken(secret: string, claims: SignupClaims, now: number = Date.now()): string {
  return signTyped({ typ: 'signup', ...claims }, secret, 'vv-signup', SIGNUP_TOKEN_TTL_SECONDS, now);
}

export function verifySignupToken(token: unknown, secret: string, now: number = Date.now()): Verified<SignupClaims & { jti: string; expiresAt: Date }> {
  const v = verifyTyped(token, secret, 'vv-signup', 'signup', now);
  if (!v.ok) return v;
  const c = v.value;
  if ((c.provider !== 'GOOGLE' && c.provider !== 'APPLE') || typeof c.subject !== 'string' || !c.subject || typeof c.email !== 'string' || !c.email) {
    return { ok: false, reason: 'invalid' };
  }
  return {
    ok: true,
    value: {
      provider: c.provider,
      subject: c.subject,
      email: c.email,
      emailVerified: c.emailVerified === true,
      givenName: typeof c.givenName === 'string' ? c.givenName : null,
      familyName: typeof c.familyName === 'string' ? c.familyName : null,
      jti: c.jti as string,
      expiresAt: new Date((c.exp as number) * 1000),
    },
  };
}
