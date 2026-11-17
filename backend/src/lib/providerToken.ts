// 9.6.S2: is this ID token really from Google, for our app, for the sign-in we
// started? Verified on the server only; the client never decides who someone
// is. Pure apart from the key lookup, which the caller passes in (the real one
// fetches Google's published keys; tests pass a local key set, no network).
import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
// Google issues both spellings.
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const CLOCK_TOLERANCE_SECONDS = 60;

export type ProviderIdentity = {
  provider: 'GOOGLE';
  /** Google's permanent id for the person. The identity is this, never the email. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  /** Set for Google Workspace accounts: Google is then the authority for the address. */
  hostedDomain: string | null;
};

export type ProviderTokenResult = { ok: true; identity: ProviderIdentity } | { ok: false; reason: string };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Providers send booleans, but Apple sends the string "true": accept exactly those two. */
export function coerceEmailVerified(v: unknown): boolean {
  return v === true || v === 'true';
}

export async function verifyGoogleIdToken(
  idToken: unknown,
  opts: { keys: JWTVerifyGetKey; audiences: string[]; expectedNonce: string; now?: Date; maxTokenAgeSeconds?: number },
): Promise<ProviderTokenResult> {
  if (typeof idToken !== 'string' || !idToken) return { ok: false, reason: 'missing' };
  // No configured client id must refuse everything: jose treats an empty
  // audience list as "don't check".
  const audiences = opts.audiences.filter(Boolean);
  if (audiences.length === 0) return { ok: false, reason: 'not-configured' };
  if (!opts.expectedNonce) return { ok: false, reason: 'missing-nonce' };

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, opts.keys, {
      issuer: GOOGLE_ISSUERS,
      audience: audiences,
      algorithms: ['RS256'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ['exp', 'sub', 'aud', 'iss'],
      // For re-authentication (delete account): the sign-in itself must be recent.
      // jose then also requires `iat`.
      ...(opts.maxTokenAgeSeconds ? { maxTokenAge: opts.maxTokenAgeSeconds } : {}),
      currentDate: opts.now,
    }));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ERR_JWT_EXPIRED') return { ok: false, reason: 'expired' };
    // Google's key server timing out or answering badly (or a plain network
    // error, which has no jose code) is an outage, not a bad token. Still refused.
    if (code === undefined || code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JOSE_GENERIC') return { ok: false, reason: 'unavailable' };
    return { ok: false, reason: 'invalid' };
  }

  // The token must answer the nonce WE issued for THIS attempt; a token minted
  // for another session (or another site using the same client id) fails here.
  if (typeof payload.nonce !== 'string' || payload.nonce !== opts.expectedNonce) return { ok: false, reason: 'bad-nonce' };
  const subject = str(payload.sub);
  if (!subject) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    identity: {
      provider: 'GOOGLE',
      subject,
      email: str(payload.email)?.toLowerCase() ?? null,
      emailVerified: coerceEmailVerified(payload.email_verified),
      givenName: str(payload.given_name),
      familyName: str(payload.family_name),
      hostedDomain: str(payload.hd),
    },
  };
}
