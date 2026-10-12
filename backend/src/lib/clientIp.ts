// Which client address the per-IP rate limits key on (9.6.R3). Pure, so every
// branch is tested; middleware/rateLimit.ts's clientIp() is the Express adapter.
type Headers = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function pickClientIp(opts: { headers: Headers; proxyVerified: boolean; onFly: boolean; socketIp?: string }): string {
  const { headers, proxyVerified, onFly, socketIp } = opts;

  // Signed by Netlify, so Netlify's own view of the caller. If that header
  // doesn't arrive (R6 checks), fall back to fly-client-ip: Netlify's edge hop,
  // shared by many users but still several buckets rather than the single
  // 'unknown' one that would lock everyone out together. ponytail: if R6 shows
  // no client address at all, add per-account limits (R3 fallback plan).
  if (proxyVerified) {
    return first(headers['x-nf-client-connection-ip'])?.trim() || first(headers['fly-client-ip'])?.trim() || 'unknown';
  }

  // On Fly but unsigned: the caller reached *.fly.dev directly and wrote every
  // header itself, so only the socket is believed. (requireProxySignature has
  // already refused these; this keeps the limiter safe on its own.)
  if (onFly) return socketIp ?? 'unknown';

  // The Netlify Function and local dev, unchanged from before Fly: Netlify sets
  // x-nf-client-connection-ip there itself. Falling back to x-forwarded-for,
  // take the RIGHT-most entry: proxies append, so the left-most is whatever the
  // caller wrote and the right-most is what the nearest proxy observed.
  const direct = first(headers['x-nf-client-connection-ip']);
  if (direct) return direct.trim();
  const forwarded = headers['x-forwarded-for'];
  const chain = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  const nearest = chain?.split(',').pop();
  return (nearest ?? socketIp ?? 'unknown').trim();
}
