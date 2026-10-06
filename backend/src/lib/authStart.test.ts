import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initialAuthState } from './authStart';

const decode = (t: string) => (t === 'tok-u1' ? 'u1' : t === 'tok-u2' ? 'u2' : null);

assert.equal(initialAuthState(null, null, decode), 'sign-in', 'no token: sign in');
assert.equal(initialAuthState(null, 'u1', decode), 'sign-in', 'a cache alone never signs anyone in');
assert.equal(initialAuthState('', 'u1', decode), 'sign-in');
assert.equal(initialAuthState('tok-u1', 'u1', decode), 'render', "the token's own cached account renders at once");
assert.equal(initialAuthState('tok-u1', null, decode), 'wait', 'no cache: wait for /auth/me');
assert.equal(initialAuthState('tok-u1', 'u2', decode), 'wait', "someone else's cache must never render with this token");
assert.equal(initialAuthState('garbage', 'u1', decode), 'wait', 'an undecodable token never renders, even with a cache');
assert.equal(initialAuthState('garbage', null, decode), 'wait');

// The frontend keeps a copy (it has no test runner): from the AuthStart type
// to the end it must stay identical to this tested file.
const logic = (file: string) => {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return src.slice(src.indexOf('export type AuthStart'));
};
assert.equal(
  logic(path.join(__dirname, '../../../frontend/src/lib/authStart.ts')),
  logic(path.join(__dirname, 'authStart.ts')),
  'frontend/src/lib/authStart.ts has drifted from the tested backend copy',
);

console.log('authStart.test.ts passed');
