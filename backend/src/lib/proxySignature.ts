// 9.6.R3: proof a request came through Netlify's proxy rather than straight to
// *.fly.dev. With `signed = "API_PROXY_SIGNING_SECRET"` on the proxy rule,
// Netlify adds `x-nf-sign` to every proxied request: an HS256 JWS over
// { deploy_context, exp, iss: "netlify", netlify_id, site_url }.
// https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/#signed-proxy-redirects
// Pure: no Express, no Prisma.
import jwt, { JwtPayload } from 'jsonwebtoken';

export type ProxySignatureResult = { ok: true; claims: JwtPayload } | { ok: false; reason: string };

// Netlify signs with exp about 300 s ahead (measured on staging, 16 Nov 2026).
// Anything much further out wasn't minted by Netlify's proxy for this request,
// and would stay replayable for as long as it claims.
export const MAX_SIGNATURE_TTL_SECONDS = 600;

/**
 * True when the signed site_url is the pinned site or one of its draft/branch
 * deploys, which Netlify signs as https://<alias>--<site host> (measured on
 * staging: rehearse--volleyvision-staging.netlify.app, deploy_context branch-deploy).
 */
export function siteMatches(claimed: unknown, pinned: string): boolean {
  if (typeof claimed !== 'string') return false;
  try {
    const got = new URL(claimed);
    const want = new URL(pinned);
    return got.protocol === 'https:' && (got.host === want.host || got.host.endsWith(`--${want.host}`));
  } catch {
    return false;
  }
}

export function verifyProxySignature(
  header: string | string[] | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): ProxySignatureResult {
  // An array means the header arrived twice: one of them isn't Netlify's.
  if (typeof header !== 'string' || !header) return { ok: false, reason: 'missing' };
  if (!secret) return { ok: false, reason: 'no-secret' };
  try {
    const claims = jwt.verify(header, secret, {
      // Pinned, so a token can't pick its own algorithm (alg: none, or an
      // RS256 header verified against the HMAC secret as a "public key").
      algorithms: ['HS256'],
      issuer: 'netlify',
      clockTolerance: 60, // seconds of drift between Netlify's clock and Fly's
      clockTimestamp: Math.floor(now / 1000),
    });
    // jsonwebtoken accepts a token with no exp; one that never expires could be
    // replayed forever by anyone who ever saw it. Netlify always sends exp.
    if (typeof claims === 'string' || typeof claims.exp !== 'number') return { ok: false, reason: 'no-exp' };
    if (claims.exp - Math.floor(now / 1000) > MAX_SIGNATURE_TTL_SECONDS) return { ok: false, reason: 'exp-too-far' };
    return { ok: true, claims };
  } catch (err) {
    return { ok: false, reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }
}
