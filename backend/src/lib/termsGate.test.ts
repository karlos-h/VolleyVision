import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { termsStepCovers } from './termsGate';

// Live tracking and account deletion stay open while the Terms are pending.
for (const p of ['/matches/cmabc123/track', '/matches/cmabc123/track/', '/track/cmabc123', '/profile/delete-account']) {
  assert.equal(termsStepCovers(p), false, `${p} must stay open`);
}

// Every other signed-in page still shows the Terms step, including the
// match's other tabs and anything that merely contains "track".
for (const p of [
  '/dashboard', '/teams/t1', '/teams/t1/chat', '/matches/m1', '/matches/m1/events', '/matches/m1/watch',
  '/matches/m1/track/extra', '/matches//track', '/matches/m1/tracking', '/track', '/track/', '/track/m1/x',
  '/profile', '/profile/delete-account/x', '/feedback', '/x/matches/m1/track',
]) {
  assert.equal(termsStepCovers(p), true, `${p} must show the Terms step`);
}

// The frontend keeps a copy (it has no test runner): its logic, from EXEMPT to
// the end, must stay identical to this tested file.
const logic = (file: string) => {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return src.slice(src.indexOf('const EXEMPT'));
};
assert.equal(
  logic(path.join(__dirname, '../../../frontend/src/lib/termsGate.ts')),
  logic(path.join(__dirname, 'termsGate.ts')),
  'frontend/src/lib/termsGate.ts has drifted from the tested backend copy',
);

console.log('termsGate: all tests passed');
