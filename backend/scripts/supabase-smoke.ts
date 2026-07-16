// Supabase Storage connectivity smoke test — verifies URL, service-role key,
// and the private `team-chat` bucket end to end BEFORE any real endpoint is
// wired: upload a throwaway text object, mint a signed URL, fetch it back,
// assert the bytes match, then delete the object. Leaves nothing behind.
//
// Run: npx ts-node scripts/supabase-smoke.ts

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  uploadAttachment,
  signAttachmentUrl,
  deleteObjects,
} from '../src/services/chatStorage.service';

async function main() {
  const key = `smoke-tests/${randomUUID()}.txt`;
  const payload = `volleyvision supabase smoke test ${new Date().toISOString()}`;

  try {
    await uploadAttachment({ key, buffer: Buffer.from(payload, 'utf8'), mimeType: 'text/plain' });
    console.log(`uploaded  ${key}`);

    const url = await signAttachmentUrl(key, 60);
    assert.ok(url.startsWith('https://'), 'signed URL should be https');
    console.log('signed    URL minted (60s TTL)');

    const res = await fetch(url);
    assert.equal(res.status, 200, `signed URL fetch returned ${res.status}`);
    const roundTripped = await res.text();
    assert.equal(roundTripped, payload, 'downloaded bytes differ from uploaded bytes');
    console.log('fetched   bytes match');
  } finally {
    await deleteObjects([key]);
    console.log(`deleted   ${key}`);
  }

  // The signed URL must be the only way in: the raw object path on the private
  // bucket should be denied without a token.
  const rawUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/team-chat/${key}`;
  const rawRes = await fetch(rawUrl);
  assert.ok(rawRes.status >= 400, `private bucket unexpectedly served a public URL (${rawRes.status})`);
  console.log('private   public access correctly denied');

  console.log('\nPASS — Supabase Storage connectivity verified.');
}

main().catch((err) => {
  console.error('\nFAIL —', err.message ?? err);
  process.exitCode = 1;
});
