import assert from 'node:assert/strict';
import { formatServerTiming, serverTimingEnabled, withRequestStore, getRequestStore, noteDbOperation, timeDbOperation } from './serverTiming';

async function main() {
  // Exact shape, durations rounded.
  assert.equal(formatServerTiming({ dbMs: 812.4, dbOps: 11, appMs: 904.6, cold: true }), 'db;dur=812;desc="ops=11", app;dur=905, cold;desc="1"');
  assert.equal(
    formatServerTiming({ dbMs: 0, dbOps: 0, appMs: 0.4, cold: false, region: 'us-east-2' }),
    'db;dur=0;desc="ops=0", app;dur=0, cold;desc="0", fn;desc="us-east-2"',
  );
  // The region is the one free-text value: nothing that could break out of the quotes or the header.
  assert.equal(formatServerTiming({ dbMs: 1, dbOps: 1, appMs: 1, cold: false, region: 'us-east-2"\r\nSet-Cookie: x' }), 'db;dur=1;desc="ops=1", app;dur=1, cold;desc="0", fn;desc="us-east-2et-ookiex"');
  assert.equal(formatServerTiming({ dbMs: 1, dbOps: 1, appMs: 1, cold: false, region: '" \r\n' }), 'db;dur=1;desc="ops=1", app;dur=1, cold;desc="0"');
  assert.equal(formatServerTiming({ dbMs: 1, dbOps: 1, appMs: 1, cold: false, region: '' }), 'db;dur=1;desc="ops=1", app;dur=1, cold;desc="0"');

  // Never in production; nothing can switch it back on there.
// Fail closed inside the function: an unset NODE_ENV on Lambda is off, and a
// non-production NODE_ENV there is still off unless it's staging.
assert.equal(serverTimingEnabled({ AWS_LAMBDA_FUNCTION_NAME: 'api' }), false);
assert.equal(serverTimingEnabled({ AWS_LAMBDA_FUNCTION_NAME: 'api', NODE_ENV: 'development' }), false);
assert.equal(serverTimingEnabled({ AWS_LAMBDA_FUNCTION_NAME: 'api', SENTRY_ENVIRONMENT: 'staging', NODE_ENV: 'production' }), true);
assert.equal(serverTimingEnabled({}), true, 'npm run dev leaves NODE_ENV unset');
  assert.equal(serverTimingEnabled({ NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'staging' }), true);
  assert.equal(serverTimingEnabled({ NODE_ENV: 'test' }), true);
  assert.equal(serverTimingEnabled({}), true);
  assert.equal(serverTimingEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(serverTimingEnabled({ NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'production' }), false);
  assert.equal(serverTimingEnabled({ NODE_ENV: 'production', SERVER_TIMING: '1' }), false);

  // Outside a request there is nothing to count into.
  assert.equal(noteDbOperation('findUnique'), undefined);
  assert.equal(getRequestStore(), undefined);

  // Parallel requests keep their own counts across awaits.
  const tick = () => new Promise((r) => setTimeout(r, 1));
  const run = (n: number) => withRequestStore(async () => {
    for (let i = 0; i < n; i++) { noteDbOperation('findMany'); await tick(); }
    return getRequestStore()!.dbOps;
  });
  assert.deepEqual(await Promise.all([run(2), run(5)]), [2, 5]);
  // Nested: the inner store shadows the outer and leaves it untouched.
  withRequestStore(() => {
    noteDbOperation('a');
    withRequestStore(() => { noteDbOperation('b'); noteDbOperation('c'); assert.equal(getRequestStore()!.dbOps, 2); });
    assert.equal(getRequestStore()!.dbOps, 1);
  });

  // The hook counts, times, returns the result, and calls query synchronously.
  await withRequestStore(async () => {
    let called = false;
    const p = timeDbOperation({ operation: 'findMany', args: { where: {} }, query: async () => { called = true; await new Promise((r) => setTimeout(r, 15)); return 'rows'; } });
    assert.equal(called, true, 'query must be invoked before the hook yields');
    assert.equal(await p, 'rows');
    const store = getRequestStore()!;
    assert.equal(store.dbOps, 1);
    assert.ok(store.dbMs >= 10, `dbMs ${store.dbMs}`);
    // A failing query is still counted and timed, and the error passes through.
    await assert.rejects(timeDbOperation({ operation: 'create', args: {}, query: async () => { throw new Error('boom'); } }), /boom/);
    assert.equal(store.dbOps, 2);
  });

  console.log('serverTiming tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
