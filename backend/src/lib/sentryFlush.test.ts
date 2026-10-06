import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
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

// Every capture site must mark the flush itself (beforeSend is too late, see
// markFlushNeeded): scan src for Sentry.capture* and require markFlushNeeded()
// within the two preceding lines. A new site that forgets it loses its error
// when Lambda freezes the instance.
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  if (statSync(p).isDirectory()) return n === '__tests__' || n === '__integration__' ? [] : walk(p);
  return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
});
for (const file of walk(path.join(__dirname, '..'))) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const code = line.trim();
    if (code.startsWith('//') || code.startsWith('*') || !/Sentry\.capture(Exception|Message)\(/.test(code)) return;
    const before = lines.slice(Math.max(0, i - 2), i).join('\n');
    assert.ok(before.includes('markFlushNeeded()'), `${path.relative(process.cwd(), file)}:${i + 1} captures without markFlushNeeded()`);
  });
}

console.log('sentryFlush: ok');
})();
