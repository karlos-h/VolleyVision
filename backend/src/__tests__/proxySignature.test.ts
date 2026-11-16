// 9.6.R3: on Fly, only requests Netlify signed reach a route; /health/live
// stays open for Fly's own check. Off Fly (local dev, tests, the Netlify
// Function) nothing changes.
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { proxySignature } from '../middleware/proxySignature';

const SECRET = 'proxy-test-secret';
const signed = (secret = SECRET) =>
  jwt.sign({ iss: 'netlify', deploy_context: 'production', site_url: 'https://vv.test' }, secret, { algorithm: 'HS256', expiresIn: 60 });

function makeApp(env: NodeJS.ProcessEnv) {
  const app = express();
  app.use(proxySignature(env));
  app.get('/health/live', (_req, res) => { res.json({ live: true }); });
  app.get('/api/v1/thing', (req, res) => { res.json({ proxyVerified: req.proxyVerified === true }); });
  return app;
}

async function withApp(env: NodeJS.ProcessEnv, fn: (base: string) => Promise<void>) {
  const server = http.createServer(makeApp(env));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

async function get(base: string, path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, { headers });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

async function main() {
  // Off Fly: no signature needed, nothing marked verified.
  await withApp({}, async (base) => {
    const r = await get(base, '/api/v1/thing');
    assert.equal(r.status, 200, 'local/function requests need no signature');
    assert.equal(r.body?.proxyVerified, false);
  });

  // On Fly.
  await withApp({ FLY_APP_NAME: 'vv', API_PROXY_SIGNING_SECRET: SECRET }, async (base) => {
    const direct = await get(base, '/api/v1/thing', { 'x-nf-client-connection-ip': '6.6.6.6' });
    assert.equal(direct.status, 403, 'direct to fly.dev, unsigned: refused');
    assert.deepEqual(direct.body, { error: 'Forbidden.' });
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': signed('wrong') })).status, 403, 'bad signature');
    assert.equal((await get(base, '/health/live')).status, 200, "Fly's health check stays open");
    const via = await get(base, '/api/v1/thing', { 'x-nf-sign': signed() });
    assert.equal(via.status, 200, 'through the Netlify proxy');
    assert.equal(via.body?.proxyVerified, true);
  });

  // On Fly with the secret missing: fail closed, but keep the liveness check up.
  await withApp({ FLY_APP_NAME: 'vv' }, async (base) => {
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { errors.push(a); };
    try {
      assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': signed() })).status, 503, 'no secret: nothing is trusted');
      assert.equal((await get(base, '/api/v1/thing')).status, 503);
    } finally { console.error = orig; }
    assert.equal(errors.length, 1, 'logged once, not per request');
    assert.equal((await get(base, '/health/live')).status, 200);
  });

  // site_url pinned: a signature from another Netlify site (staging's proxy
  // pointed at prod's app) is refused; the matching site passes.
  await withApp({ FLY_APP_NAME: 'vv', API_PROXY_SIGNING_SECRET: SECRET, API_PROXY_SITE_URL: 'https://vv.test' }, async (base) => {
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': signed() })).status, 200, 'own site passes');
    const other = jwt.sign({ iss: 'netlify', deploy_context: 'production', site_url: 'https://other.test' }, SECRET, { algorithm: 'HS256', expiresIn: 60 });
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': other })).status, 403, 'another site is refused');
    const sign = (site_url: string, expiresIn = 60) => jwt.sign({ iss: 'netlify', deploy_context: 'branch-deploy', site_url }, SECRET, { algorithm: 'HS256', expiresIn });
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': sign('https://rehearse--vv.test') })).status, 200, "the site's own draft deploy passes");
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': sign('https://evil-vv.test') })).status, 403, 'a look-alike host is refused');
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': sign('https://vv.test.evil.example') })).status, 403, 'a suffix trick is refused');
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': sign('http://vv.test') })).status, 403, 'plain http is refused');
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': sign('https://vv.test', 300) })).status, 200, "Netlify's own 5 minute lifetime passes");
    assert.equal((await get(base, '/api/v1/thing', { 'x-nf-sign': sign('https://vv.test', 3600) })).status, 403, 'a long-lived signature is refused');
  });

  console.log('proxySignature.test.ts passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
