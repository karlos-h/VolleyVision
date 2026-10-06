// Production runs the app through serverless-http (netlify-functions/api.js),
// which hands Express a fake request/response with no http.Server. This proves
// the per-request store survives that path, including JSON body parsing, and
// that counts don't leak from one invocation into the next in a warm instance.
import assert from 'node:assert/strict';
import { db, resetDb } from '../testing/installFakePrisma';
import '../testing/testEnv'; // must precede ../index
import app from '../index';

const serverless = require('serverless-http');
const handler = serverless(app);

const SHAPE = /^db;dur=\d+;desc="ops=(\d+)", app;dur=\d+, cold;desc="[01]"/;

function event(httpMethod: string, path: string, body?: unknown) {
  return {
    httpMethod, path, body: body === undefined ? '' : JSON.stringify(body), isBase64Encoded: false,
    headers: { host: 'example.test', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
    requestContext: { identity: { sourceIp: '127.0.0.1' } },
  };
}

async function ops(httpMethod: string, path: string, body?: unknown): Promise<{ status: number; ops: number }> {
  const res = await handler(event(httpMethod, path, body), {});
  const header = res.headers['server-timing'];
  const m = SHAPE.exec(header ?? '');
  assert.ok(m, `${httpMethod} ${path}: Server-Timing ${header}`);
  return { status: res.statusCode, ops: Number(m[1]) };
}

async function main() {
  resetDb();
  db.user.findUnique = async () => null;

  assert.deepEqual(await ops('GET', '/health'), { status: 200, ops: 1 });
  const login = await ops('POST', '/api/v1/auth/login', { email: 'nobody@example.test', password: 'x' });
  assert.ok([400, 401].includes(login.status), `login answered ${login.status}`);
  assert.ok(login.ops >= 1, 'the lookup after body parsing is counted in this request');
  assert.deepEqual(await ops('GET', '/health'), { status: 200, ops: 1 }, 'counts are per invocation, not cumulative');

  console.log('serverlessHttp.serverTiming.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
