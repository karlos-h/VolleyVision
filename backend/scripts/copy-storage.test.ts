// Pure-logic checks for copy-storage.ts (no Supabase). npx ts-node --transpile-only scripts/copy-storage.test.ts
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildManifest, diffManifests, isInside, joinPath, localFile, parseArgs } from './copy-storage';

assert.equal(joinPath('', 'a.png'), 'a.png');
assert.equal(joinPath('team/1', 'a.png'), 'team/1/a.png');

const want = buildManifest({ 'team-chat': [{ path: 'b/2.png', size: 5 }, { path: 'a/1.png', size: 3 }] });
assert.deepEqual(want['team-chat'].objects.map((o) => o.path), ['a/1.png', 'b/2.png']);
assert.equal(want['team-chat'].bytes, 8);
assert.deepEqual(diffManifests(want, buildManifest({ 'team-chat': [{ path: 'a/1.png', size: 3 }, { path: 'b/2.png', size: 5 }] })), []);
assert.ok(diffManifests(want, buildManifest({ 'team-chat': [{ path: 'a/1.png', size: 3 }] })).length >= 2, 'a missing object is reported');
assert.ok(diffManifests(want, buildManifest({ 'team-chat': [{ path: 'a/1.png', size: 4 }, { path: 'b/2.png', size: 5 }] })).some((p) => p.includes('a/1.png')), 'a size change is reported');
assert.ok(diffManifests(want, {}).some((p) => p.includes('bucket missing')));
assert.ok(diffManifests(want, { ...want, extra: { count: 0, bytes: 0, objects: [] } }).some((p) => p.includes('not in the manifest')));

const root = path.resolve('/tmp/x');
assert.ok(isInside(root, path.join(root, 'a')));
assert.ok(isInside(root, root));
assert.ok(!isInside(root, path.resolve('/tmp/xy')));
assert.ok(!isInside(root, path.resolve('/tmp')));
assert.throws(() => localFile(root, 'b', '../../etc/passwd'));
assert.throws(() => localFile(root, 'b', ''));
assert.ok(localFile(root, 'b', 'a/c.png').endsWith(path.join('b', 'a', 'c.png')));

assert.deepEqual(parseArgs(['--export', '--to-dir', 'out']), { mode: 'export', dir: path.resolve('out'), apply: false });
assert.deepEqual(parseArgs(['--import', '--from-dir', 'in', '--apply']), { mode: 'import', dir: path.resolve('in'), apply: true });
assert.equal(typeof parseArgs(['--export']), 'string');
assert.equal(typeof parseArgs(['--export', '--import', '--to-dir', 'x']), 'string');
assert.equal(typeof parseArgs([]), 'string');
console.log('copy-storage.test.ts passed.');
