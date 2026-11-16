// 9.6.0.3: chat/feedback uploads are spooled to disk (not memoryStorage) so a
// 10 x 25 MB request can't pin ~250 MB of a 1 GB machine. Covers: the 60 MB
// per-request cap (declared Content-Length, and summed size for chunked
// bodies), and that temp files are gone after success and after every error.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { db, resetDb } from '../testing/installFakePrisma';
import { withServer, tokenFor } from '../testing/http';

const TMP = path.join(os.tmpdir(), 'vv-uploads');
const left = () => (fs.existsSync(TMP) ? fs.readdirSync(TMP) : []);

// Fake Supabase Storage: counts uploads, can be told to fail.
let uploads = 0;
let failUpload = false;
const supabase = require('../lib/supabase');
supabase.getSupabaseClient = () => ({
  storage: {
    from: () => ({
      upload: async () => {
        uploads++;
        return { error: failUpload ? { message: 'boom' } : null };
      },
      remove: async () => ({ error: null }),
    }),
  },
});

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1024, 1)]);
let n = 0; // a fresh user per request: chatPostRateLimit is 10 per 5 s per user

function world() {
  resetDb();
  db.user.findUnique = async () => ({ tokenVersion: 0, role: 'COACH', signupIntent: null });
  db.feedback.create = async (args: any) => ({ id: args.data.id, ...args.data, attachments: [] });
  uploads = 0;
  failUpload = false;
}

async function postForm(base: string, parts: { type: string; name: string; data: Buffer }[]) {
  const form = new FormData();
  form.set('type', 'GENERAL');
  form.set('subject', 's');
  form.set('description', 'd');
  for (const p of parts) form.append('files', new Blob([p.data], { type: p.type }), p.name);
  const res = await fetch(`${base}/api/v1/feedback`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenFor(`u${++n}`)}` },
    body: form,
  });
  await res.text();
  return res.status;
}

// Raw request so the test controls the headers (no Content-Length = chunked).
function rawPost(base: string, headers: Record<string, string>, chunks: Buffer[], destroyAfterResponse = false) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    setTimeout(() => reject(new Error('no response: the request was not rejected')), 8000).unref();
    const url = new URL(base);
    const req = http.request(
      { host: url.hostname, port: url.port, method: 'POST', path: '/api/v1/feedback', headers: { authorization: `Bearer ${tokenFor(`u${++n}`)}`, ...headers } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode!, body }));
        if (destroyAfterResponse) res.on('data', () => req.destroy());
      },
    );
    req.on('error', (e) => (destroyAfterResponse ? undefined : reject(e)));
    for (const c of chunks) req.write(c);
    if (!destroyAfterResponse) req.end();
  });
}

const settle = () => new Promise((r) => setTimeout(r, 100)); // res 'close' runs the cleanup

async function main() {
  await withServer(async (base) => {
    world();
    assert.deepEqual(left(), [], 'start clean');

    // Success: files uploaded, nothing left on disk.
    assert.equal(await postForm(base, [{ type: 'application/pdf', name: 'a.pdf', data: PDF }, { type: 'application/pdf', name: 'b.pdf', data: PDF }]), 201);
    await settle();
    assert.equal(uploads, 2);
    assert.deepEqual(left(), [], 'temp files removed after success');

    // Validation failure (unsupported type): 400, nothing uploaded, nothing on disk.
    world();
    assert.equal(await postForm(base, [{ type: 'application/pdf', name: 'a.pdf', data: PDF }, { type: 'application/x-msdownload', name: 'a.exe', data: PDF }]), 400);
    await settle();
    assert.equal(uploads, 0, 'all-or-nothing: validation runs before any upload');
    assert.deepEqual(left(), [], 'temp files removed after a validation error');

    // Storage failure: 502, nothing on disk.
    world();
    failUpload = true;
    assert.equal(await postForm(base, [{ type: 'application/pdf', name: 'a.pdf', data: PDF }]), 502);
    await settle();
    assert.deepEqual(left(), [], 'temp files removed after an upload failure');

    // Declared Content-Length over the cap: rejected before the body is read.
    world();
    const early = await rawPost(
      base,
      { 'content-type': 'multipart/form-data; boundary=xx', 'content-length': String(70 * 1024 * 1024) },
      [Buffer.from('--xx\r\n')],
      true,
    );
    assert.equal(early.status, 400);
    assert.match(early.body, /60 MB/);
    assert.deepEqual(left(), []);

    // Chunked body (no Content-Length): 3 x 21 MB passes multer's per-file cap
    // but not the summed one; the temp files must still be removed.
    world();
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(21 * 1024 * 1024, 2)]);
    const chunks: Buffer[] = [];
    for (const f of ['one', 'two', 'three']) {
      chunks.push(Buffer.from(`--xx\r\nContent-Disposition: form-data; name="files"; filename="${f}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`), big, Buffer.from('\r\n'));
    }
    for (const [k, v] of [['type', 'GENERAL'], ['subject', 's'], ['description', 'd']]) {
      chunks.push(Buffer.from(`--xx\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    chunks.push(Buffer.from('--xx--\r\n'));
    const summed = await rawPost(base, { 'content-type': 'multipart/form-data; boundary=xx', 'transfer-encoding': 'chunked' }, chunks);
    assert.equal(summed.status, 400);
    assert.match(summed.body, /60 MB/);
    assert.equal(uploads, 0);
    await settle();
    assert.deepEqual(left(), [], 'temp files removed after the summed-size rejection');
  });
  console.log('http.uploadTemp.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
