// 9.5.1: every response outside production carries Server-Timing with the
// request's own database operation count, and never anything identifying.
import assert from 'node:assert/strict';
import { db, resetDb } from '../testing/installFakePrisma';
import { withServer } from '../testing/http';

const SHAPE = /^db;dur=\d+;desc="ops=(\d+)", app;dur=\d+, cold;desc="([01])"/;

async function timing(base: string, path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, init);
  await res.text();
  return { status: res.status, header: res.headers.get('server-timing') };
}

async function main() {
  resetDb();
  await withServer(async (base) => {
    const first = await timing(base, '/health');
    assert.equal(first.status, 200);
    assert.match(first.header ?? '', /^db;dur=\d+;desc="ops=1", app;dur=\d+, cold;desc="[01]"/);
    const second = await timing(base, '/health');
    assert.match(second.header ?? '', /^db;dur=\d+;desc="ops=1", app;dur=\d+, cold;desc="0"/, 'per request, and only the first is cold');

    // The count survives body parsing: login's user lookup runs after express.json.
    db.user.findUnique = async () => null;
    const login = await timing(base, '/api/v1/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.test', password: 'x' }),
    });
    assert.equal(login.status, 401);
    assert.ok(Number(SHAPE.exec(login.header ?? '')?.[1]) >= 1, `login counted its lookup: ${login.header}`);

    const id = 'cabcdefghijklmnopqrstuvwx';
    db.team.findUnique = async () => null;
    const missing = await timing(base, `/api/v1/teams/${id}`);
    assert.equal(missing.status, 404);
    assert.match(missing.header ?? '', SHAPE);
    assert.ok(!missing.header!.includes(id), 'no ids in the header');

    // Production (not staging): no header at all.
    const env = { NODE_ENV: process.env.NODE_ENV, SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT };
    process.env.NODE_ENV = 'production';
    delete process.env.SENTRY_ENVIRONMENT;
    try {
      const prod = await timing(base, '/health');
      assert.equal(prod.status, 200);
      assert.equal(prod.header, null, 'production must not send Server-Timing');
      process.env.SENTRY_ENVIRONMENT = 'staging';
      assert.match((await timing(base, '/health')).header ?? '', SHAPE, 'staging does');
    } finally {
      process.env.NODE_ENV = env.NODE_ENV;
      if (env.SENTRY_ENVIRONMENT === undefined) delete process.env.SENTRY_ENVIRONMENT;
      else process.env.SENTRY_ENVIRONMENT = env.SENTRY_ENVIRONMENT;
    }
  });
  console.log('http.serverTiming.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
