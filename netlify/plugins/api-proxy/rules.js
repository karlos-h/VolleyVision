// Pure so the staging-never-proxies-to-prod guarantee is testable without Netlify.
// An exact allow-list (not a pattern): a typo or a missing variable must fail the
// build rather than quietly send a site's traffic to the wrong API.
const PROD = 'https://volleyvision-api.fly.dev';
const STAGING = 'https://volleyvision-api-staging.fly.dev';
const ALLOWED = [PROD, STAGING, 'function'];

// Netlify adds an x-nf-sign JWS header signed with this site env var, so the
// Fly app can refuse requests that did not come through our Netlify site.
const SIGNING_ENV = 'API_PROXY_SIGNING_SECRET';

function buildProxyRules(apiOrigin) {
  if (!ALLOWED.includes(apiOrigin)) {
    throw new Error(`API_ORIGIN must be exactly one of ${ALLOWED.join(', ')} (got ${JSON.stringify(apiOrigin)})`);
  }
  // 'function' is the rollback: the toml rewrites to the Netlify Function apply.
  if (apiOrigin === 'function') return [];
  const common = { status: 200, force: true, signed: SIGNING_ENV };
  return [
    { from: '/api/v1/*', to: `${apiOrigin}/api/v1/:splat`, ...common },
    { from: '/health', to: `${apiOrigin}/health`, ...common },
  ];
}

module.exports = { buildProxyRules, ALLOWED };
