// 9.6.S2: nonces and Google ID-token checks for social sign-in. The pure parts
// live in lib/socialTokens.ts and lib/providerToken.ts; this file adds the
// environment, Google's published keys and the single-use record.
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { NONCE_TTL_SECONDS, NoncePurpose, signNonce, verifyNonce } from '../lib/socialTokens';
import { GOOGLE_JWKS_URL, ProviderIdentity, verifyGoogleIdToken } from '../lib/providerToken';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return secret;
}

/** Non-secret env. The iOS id only matters once the iOS app shows the button (9.7). */
export function googleAudiences(env: NodeJS.ProcessEnv = process.env): string[] {
  return [env.GOOGLE_WEB_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID].map((v) => v?.trim() ?? '').filter(Boolean);
}

// Built on first use: jose caches Google's keys and refetches when a token
// names a key id it hasn't seen, so key rotation needs nothing from us.
let googleKeys: JWTVerifyGetKey | null = null;
function remoteGoogleKeys(): JWTVerifyGetKey {
  googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return googleKeys;
}

/**
 * Integration tests only: swap Google's published keys for a local key set, so
 * the real routes run without the network. Reachable only from inside the
 * process, and refused outside NODE_ENV=test.
 */
export function setGoogleKeysForTests(keys: JWTVerifyGetKey | null): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('setGoogleKeysForTests is for tests only.');
  googleKeys = keys;
}

/** Link and delete nonces belong to the signed-in user asking; sign-in nonces to nobody. */
export function issueNonce(purpose: NoncePurpose, userId?: string): { nonce: string; expiresIn: number } {
  if (purpose !== 'signin' && !userId) throw new AppError(401, 'Authentication required.');
  return { nonce: signNonce(jwtSecret(), purpose, Date.now(), purpose === 'signin' ? undefined : userId), expiresIn: NONCE_TTL_SECONDS };
}

const REJECTED = 'That sign-in could not be verified. Try again.';

/**
 * Checks a Google ID token against the nonce the client was given, then burns
 * the nonce. One generic 401 for every failure: the reason goes to the log,
 * never to the caller.
 */
export async function verifyGoogleSignIn(
  input: { idToken: unknown; nonce: unknown; purpose: NoncePurpose; userId?: string; maxTokenAgeSeconds?: number },
  deps: { keys?: JWTVerifyGetKey; audiences?: string[] } = {},
): Promise<ProviderIdentity> {
  const nonce = verifyNonce(input.nonce, jwtSecret(), input.purpose);
  if (!nonce.ok) throw rejected(`nonce ${nonce.reason}`);
  // A link/delete nonce only works for the account it was issued to.
  if (input.purpose !== 'signin' && (!input.userId || nonce.value.uid !== input.userId)) throw rejected('nonce for another account');

  const token = await verifyGoogleIdToken(input.idToken, {
    keys: deps.keys ?? remoteGoogleKeys(),
    audiences: deps.audiences ?? googleAudiences(),
    expectedNonce: input.nonce as string,
    maxTokenAgeSeconds: input.maxTokenAgeSeconds,
  });
  if (!token.ok) {
    if (token.reason === 'not-configured' || token.reason === 'unavailable') {
      console.warn(`social sign-in unavailable: ${token.reason}`);
      throw new AppError(503, 'Sign in with Google is not available right now. Try again in a minute.');
    }
    throw rejected(`id token ${token.reason}`);
  }

  // Single use, last: only a nonce that passed every check is spent, and the
  // primary key makes two racing requests with the same nonce one winner.
  try {
    await prisma.revokedToken.create({ data: { jti: nonce.value.jti, expiresAt: nonce.value.expiresAt } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw rejected('nonce replayed');
    throw err;
  }
  // Same best-effort sweep as sign-out: rows nothing can use any more.
  await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  return token.identity;
}

function rejected(reason: string): AppError {
  console.warn(`social sign-in rejected: ${reason}`);
  return new AppError(401, REJECTED, 'SOCIAL_TOKEN_REJECTED');
}
