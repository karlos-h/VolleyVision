// 9.6.R3: proof a request came through Netlify's proxy rather than straight to
// *.fly.dev. With `signed = "API_PROXY_SIGNING_SECRET"` on the proxy rule,
// Netlify adds `x-nf-sign` to every proxied request: an HS256 JWS over
// { deploy_context, exp, iss: "netlify", netlify_id, site_url }.
// https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/#signed-proxy-redirects
// Pure: no Express, no Prisma.
import jwt, { JwtPayload } from 'jsonwebtoken';

export type ProxySignatureResult = { ok: true; claims: JwtPayload } | { ok: false; reason: string };

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
    return { ok: true, claims };
  } catch (err) {
    return { ok: false, reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }
}
