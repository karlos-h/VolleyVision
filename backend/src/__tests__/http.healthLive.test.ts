// /health/live never touches the DB (Fly's check: a DB blip must not restart the
// machine); /health does. API responses must not be cacheable or carry ETags.
import assert from 'node:assert/strict';
import './../testing/installFakePrisma';
import { resetDb, rawFailure } from '../testing/fakePrisma';
import { withServer } from '../testing/http';

async function main() {
  resetDb();
  rawFailure.error = new Error('db down');
  await withServer(async (base) => {
    const live = await fetch(`${base}/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: 'ok' });
    assert.equal(live.headers.get('cache-control'), 'no-store');
    assert.equal(live.headers.get('etag'), null);

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 503);
    assert.equal(health.headers.get('cache-control'), 'no-store');

    const api = await fetch(`${base}/api/v1/auth/me`);
    assert.equal(api.status, 401);
    assert.equal(api.headers.get('cache-control'), 'no-store');
    assert.equal(api.headers.get('etag'), null);
  });
  console.log('http.healthLive.test.ts passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
