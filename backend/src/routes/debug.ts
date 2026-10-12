// R3 investigation; delete after R6. Shows which client-address headers reach
// Fly through Netlify's proxy, so clientIp() can be checked against reality.
// Staging only, under /api/v1 because that is all the proxy forwards, and
// behind requireProxySignature like everything else. Values only for the four
// address headers: never Authorization, cookies or x-nf-sign.
import { Express, Router } from 'express';

const SHOWN = ['x-nf-client-connection-ip', 'x-forwarded-for', 'fly-client-ip', 'x-real-ip'];

const router = Router();

router.get('/debug/headers', (req, res) => {
  res.json({
    names: Object.keys(req.headers).sort(),
    values: Object.fromEntries(SHOWN.map((h) => [h, req.headers[h] ?? null])),
    proxyVerified: req.proxyVerified === true,
    socket: req.socket.remoteAddress ?? null,
  });
});

export function mountDebugRoutes(app: Express, env: NodeJS.ProcessEnv = process.env): void {
  if (env.SENTRY_ENVIRONMENT === 'staging') app.use('/api/v1', router);
}
