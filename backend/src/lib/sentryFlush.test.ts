import assert from 'node:assert/strict';
import { wrapBeforeSend, takeFlushNeeded, markFlushNeeded } from './sentryFlush';

(async () => {
  assert.equal(takeFlushNeeded(), false, 'never wrapped: no flush');

  const wrapped = wrapBeforeSend((e: { a: number }) => ({ a: e.a + 1 }));
  assert.equal(takeFlushNeeded(), false, 'wrapping alone does not flag');
  assert.deepEqual(await wrapped({ a: 1 }, {}), { a: 2 });
  assert.equal(takeFlushNeeded(), true);
  assert.equal(takeFlushNeeded(), false, 'flag resets after being taken');

  const dropper = wrapBeforeSend<{ a: number }>(() => null);
  assert.equal(await dropper({ a: 1 }, {}), null);
  assert.equal(takeFlushNeeded(), true, 'a dropped event still flags');

  // markFlushNeeded: the synchronous path capture sites and the 500 handler use.
assert.equal(takeFlushNeeded(), false);
markFlushNeeded();
assert.equal(takeFlushNeeded(), true);
assert.equal(takeFlushNeeded(), false);

console.log('sentryFlush: ok');
})();
