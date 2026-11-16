// Proves check-version.mjs fails a release whose build.gradle versionName was
// not bumped to the tag (v9.18.1 shipped with 9.18.0).
//   node scripts/check-version.test.mjs
import assert from 'node:assert/strict';
import { versionNameOf, checkVersion } from './check-version.mjs';

const gradle = (v) => `defaultConfig {\n  versionCode 5 // x\n  versionName "${v}" // the one place\n}`;

assert.equal(versionNameOf(gradle('9.19.0')), '9.19.0');
assert.equal(versionNameOf('no version here'), null);

assert.equal(checkVersion(gradle('9.19.0'), 'v9.19.0'), null, 'v-prefixed tag matches');
assert.equal(checkVersion(gradle('9.19.0'), '9.19.0'), null, 'bare tag matches');
assert.match(checkVersion(gradle('9.18.0'), 'v9.18.1'), /9\.18\.0.*9\.18\.1/, 'mismatch fails');
assert.match(checkVersion(gradle('9.19.0'), 'v9.19.0-rc1'), /9\.19\.0/, 'a suffix is a mismatch');
assert.match(checkVersion('nothing', 'v9.19.0'), /versionName/, 'missing versionName fails');
assert.match(checkVersion(gradle('9.19.0'), ''), /tag/i, 'no tag fails');

console.log('check-version.test.mjs passed');
