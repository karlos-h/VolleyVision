// A 500 must leave the function flushing Sentry (lib/sentryFlush.ts): the
// Express error handler is the one capture site whose beforeSend runs after
// api.js has already decided. A 4xx is not captured, so it must not flag.
import assert from 'node:assert/strict';
import { AppError, errorHandler } from '../middleware/errorHandler';
import { takeFlushNeeded } from '../lib/sentryFlush';

const silent = console.error;
console.error = () => {};
const res = () => {
  const r: any = { statusCode: 0, body: undefined };
  r.status = (s: number) => { r.statusCode = s; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  return r;
};
const req: any = {};
const next: any = () => {};

let r = res();
errorHandler(new AppError(404, 'Team not found.'), req, r, next);
assert.equal(r.statusCode, 404);
assert.equal(takeFlushNeeded(), false, 'a 4xx is not captured, so no flush');

r = res();
errorHandler(new Error('boom'), req, r, next);
assert.equal(r.statusCode, 500);
assert.equal(takeFlushNeeded(), true, 'a 500 flags the flush synchronously');
assert.equal(takeFlushNeeded(), false);

console.error = silent;
console.log('errorHandlerFlush.test.ts passed');
