// Pure-logic checks for rewrite-storage-urls.ts. npx ts-node --transpile-only scripts/rewrite-storage-urls.test.ts
import assert from 'node:assert/strict';
import { guardError, rewriteUrl } from './rewrite-storage-urls';

const OLD = 'rkkhrmhorgdqkxflipui';
const NEW = 'abcdefghijklmnopqrst';
const img = `https://${OLD}.supabase.co/storage/v1/object/public/avatars/u1.png`;
assert.equal(rewriteUrl(img, OLD, NEW), `https://${NEW}.supabase.co/storage/v1/object/public/avatars/u1.png`);
assert.equal(rewriteUrl('https://example.com/a.png', OLD, NEW), 'https://example.com/a.png');
assert.equal(rewriteUrl(`${OLD}.supabase.co ${OLD}.supabase.co`, OLD, NEW), `${NEW}.supabase.co ${NEW}.supabase.co`);

const newUrl = `postgresql://postgres.${NEW}:pw@host:5432/postgres`;
assert.equal(guardError(newUrl, { apply: false }), null);
assert.equal(guardError(newUrl, { apply: true, oldRef: OLD, newRef: NEW }), null);
assert.ok(guardError('', { apply: false }));
assert.ok(guardError(`postgresql://postgres.${OLD}:pw@host/postgres`, { apply: false }), 'old prod ref in the URL');
assert.ok(guardError('postgresql://u:p@db.lnzircweyhwiemspuaav.supabase.co/postgres', { apply: false }), 'old staging ref in the URL');
assert.ok(guardError(newUrl, { apply: true }), '--apply without refs');
assert.ok(guardError(newUrl, { apply: true, oldRef: NEW, newRef: NEW }), 'old-ref must be an old project');
assert.ok(guardError(newUrl, { apply: true, oldRef: OLD, newRef: 'zzzzzzzzzzzzzzzzzzzz' }), 'URL must contain new-ref');
assert.ok(guardError(newUrl, { apply: true, oldRef: OLD, newRef: 'bad' }), 'malformed ref');
assert.equal(guardError('postgresql://ci@127.0.0.1:55433/x', { apply: true, oldRef: OLD, newRef: NEW }), null, 'local rehearsal');
console.log('rewrite-storage-urls.test.ts passed.');
