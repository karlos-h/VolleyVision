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

export function issueNonce(purpose: NoncePurpose): { nonce: string; expiresIn: number } {
  return { nonce: signNonce(jwtSecret(), purpose), expiresIn: NONCE_TTL_SECONDS };
}

const REJECTED = 'That sign-in could not be verified. Try again.';

/**
 * Checks a Google ID token against the nonce the client was given, then burns
 * the nonce. One generic 401 for every failure: the reason goes to the log,
 * never to the caller.
 */
export async function verifyGoogleSignIn(
  input: { idToken: unknown; nonce: unknown; purpose: NoncePurpose },
  deps: { keys?: JWTVerifyGetKey; audiences?: string[] } = {},
): Promise<ProviderIdentity> {
  const nonce = verifyNonce(input.nonce, jwtSecret(), input.purpose);
  if (!nonce.ok) throw rejected(`nonce ${nonce.reason}`);

  const token = await verifyGoogleIdToken(input.idToken, {
    keys: deps.keys ?? remoteGoogleKeys(),
    audiences: deps.audiences ?? googleAudiences(),
    expectedNonce: input.nonce as string,
  });
  if (!token.ok) {
    if (token.reason === 'not-configured') throw new AppError(503, 'Sign in with Google is not available right now.');
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
  return token.identity;
}

function rejected(reason: string): AppError {
  console.warn(`social sign-in rejected: ${reason}`);
  return new AppError(401, REJECTED, 'SOCIAL_TOKEN_REJECTED');
}
