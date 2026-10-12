// 9.6.R3: on Fly, refuse anything Netlify's signed proxy didn't send. The repo
// is public and *.fly.dev is easy to find, so without this a caller could skip
// Netlify and write x-nf-client-connection-ip themselves, choosing their own
// rate-limit key. Off Fly (local dev, tests, the Netlify Function) no request
// passes through the proxy, so the check is off.
import { RequestHandler } from 'express';
import { verifyProxySignature } from '../lib/proxySignature';

declare global {
  namespace Express {
    interface Request {
      /** Netlify's x-nf-sign verified: its client-address headers can be believed. */
      proxyVerified?: boolean;
    }
  }
}

let loggedNoSecret = false;

/** `env` is read per request (not captured), so tests can inject one. */
export function proxySignature(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  return (req, res, next) => {
    if (!env.FLY_APP_NAME) { next(); return; }
    // Fly's own health check comes from inside Fly, unsigned.
    if ((req.method === 'GET' || req.method === 'HEAD') && req.path === '/health/live') { next(); return; }

    const secret = env.API_PROXY_SIGNING_SECRET;
    if (!secret) {
      // Fail closed: serving unsigned traffic would quietly reopen the direct
      // route this exists to close, while a 503 everywhere is caught by the
      // first smoke check. /health/live stays up so Fly doesn't restart-loop.
      if (!loggedNoSecret) {
        loggedNoSecret = true;
        console.error('API_PROXY_SIGNING_SECRET is not set on Fly: refusing all API traffic (503).');
      }
      res.status(503).json({ error: 'Service unavailable.' });
      return;
    }

    // One generic 403 before any route runs: no database work, and nothing
    // that tells a prober why.
    const verified = verifyProxySignature(req.headers['x-nf-sign'], secret);
    // API_PROXY_SITE_URL (non-secret, fly.*.toml) pins the app to its own Netlify
    // site, so staging's proxy can't be pointed at prod's app. Optional until R6
    // confirms what site_url Netlify sends for draft deploys.
    const site = env.API_PROXY_SITE_URL;
    if (!verified.ok || (site && verified.claims.site_url !== site)) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    req.proxyVerified = true;
    next();
  };
}

export const requireProxySignature = proxySignature();
