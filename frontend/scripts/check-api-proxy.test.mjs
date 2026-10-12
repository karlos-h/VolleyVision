// Proves the api-proxy build plugin sends /api/v1/* and /health to the right Fly
// app and refuses to build for anything else, so a staging site can never
// proxy to production by a typo or a missing variable (9.6.R2).
//   node scripts/check-api-proxy.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const dir = '../../netlify/plugins/api-proxy';
const { buildProxyRules, ALLOWED } = require(`${dir}/rules.js`);
const plugin = require(`${dir}/index.js`);

const PROD = 'https://volleyvision-api.fly.dev';
const STAGING = 'https://volleyvision-api-staging.fly.dev';

for (const origin of [PROD, STAGING]) {
  assert.deepEqual(buildProxyRules(origin), [
    { from: '/api/v1/*', to: `${origin}/api/v1/:splat`, status: 200, force: true, signed: 'API_PROXY_SIGNING_SECRET' },
    { from: '/health', to: `${origin}/health`, status: 200, force: true, signed: 'API_PROXY_SIGNING_SECRET' },
  ]);
}
assert.deepEqual(buildProxyRules('function'), []);

const bad = [undefined, null, '', ' ', 'Function', 'http://volleyvision-api.fly.dev', `${PROD}/`,
  'https://evil.example', 'https://volleyvision-api.fly.dev.evil.example', `${PROD}/api`];
for (const v of bad) assert.throws(() => buildProxyRules(v), /API_ORIGIN/, `accepted ${String(v)}`);
assert.equal(ALLOWED.length, 3);

// The plugin itself: injects ahead of the existing rewrites, or fails the build.
const run = (apiOrigin) => {
  const old = process.env.API_ORIGIN;
  if (apiOrigin === undefined) delete process.env.API_ORIGIN; else process.env.API_ORIGIN = apiOrigin;
  const netlifyConfig = { redirects: [{ from: '/api/v1/*', to: '/.netlify/functions/api/api/v1/:splat', status: 200 }] };
  const utils = { build: { failBuild: (m) => { throw new Error(`FAIL: ${m}`); } } };
  try {
    plugin.onPreBuild({ netlifyConfig, utils });
    return netlifyConfig.redirects;
  } finally {
    if (old === undefined) delete process.env.API_ORIGIN; else process.env.API_ORIGIN = old;
  }
};

const injected = run(STAGING);
assert.equal(injected.length, 3);
assert.equal(injected[0].to, `${STAGING}/api/v1/:splat`);
assert.equal(injected[1].to, `${STAGING}/health`);
assert.equal(injected[2].to, '/.netlify/functions/api/api/v1/:splat');
assert.equal(run('function').length, 1);
for (const v of [undefined, '', 'http://volleyvision-api.fly.dev', 'https://evil.example']) {
  assert.throws(() => run(v), /FAIL: .*volleyvision-api\.fly\.dev.*volleyvision-api-staging\.fly\.dev.*function/s);
}

console.log('check-api-proxy: ok');
