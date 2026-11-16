import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { shouldInitSentry } from './sentryInit';
import { shouldInitSentry as shouldInitFrontendSentry } from './sentryInit.frontendCopy';

const DSN = 'https://k@o0.ingest.sentry.io/1';

// Backend
assert.equal(shouldInitSentry({}), false, 'no DSN: off');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN, NODE_ENV: 'production' }), true, 'production: on');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN, NODE_ENV: 'development' }), false, 'development: off');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN, NODE_ENV: 'test' }), false, 'test: off');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN }), false, 'NODE_ENV unset, local: off');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN, AWS_LAMBDA_FUNCTION_NAME: 'api' }), true, 'NODE_ENV unset on Lambda: on');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN, FLY_APP_NAME: 'vv' }), true, 'NODE_ENV unset on Fly: on');
assert.equal(shouldInitSentry({ NODE_ENV: 'production' }), false, 'production without DSN: off');
assert.equal(shouldInitSentry({ SENTRY_DSN: DSN, NODE_ENV: 'staging' }), true, 'other explicit NODE_ENV: on');

// Frontend (tested via its backend copy)
const f = shouldInitFrontendSentry;
assert.equal(f({ DEV: false }), false, 'no DSN: off');
assert.equal(f({ DEV: false, VITE_SENTRY_DSN: DSN }), true, 'production build: on');
assert.equal(f({ DEV: true, VITE_SENTRY_DSN: DSN }), false, 'dev server: off');
assert.equal(f({ DEV: true, VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'local-test' }), true, 'dev with explicit environment: on');
assert.equal(f({ DEV: true, VITE_SENTRY_ENVIRONMENT: 'local-test' }), false, 'dev with environment but no DSN: off');

// The frontend keeps a copy (it has no test runner): from the marker to the end
// it must stay identical to the tested file next to this one.
const logic = (file: string) => {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return src.slice(src.indexOf('export function shouldInitSentry'));
};
assert.equal(
  logic(path.join(__dirname, '../../../frontend/src/lib/sentryInit.ts')),
  logic(path.join(__dirname, 'sentryInit.frontendCopy.ts')),
  'frontend/src/lib/sentryInit.ts has drifted from the tested backend copy',
);

console.log('sentryInit.test.ts passed');
