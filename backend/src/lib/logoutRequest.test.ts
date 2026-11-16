import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { endSession } from './logoutRequest';

async function main() {
  // Like the app's axios call: the header is only looked at on a later tick,
  // by which time the stored token is already gone.
  let stored: string | null = 'tok-1';
  const sent: Array<string | undefined> = [];
  const send = async (authorization: string) => {
    await Promise.resolve();
    sent.push(authorization ?? (stored ? `Bearer ${stored}` : undefined));
  };
  endSession(() => stored, () => { stored = null; }, send);
  assert.equal(stored, null, 'cleared at once, not after the server answers');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(sent, ['Bearer tok-1'], 'the request still carries the signed-out token');

  // Nothing stored: nothing to revoke, no request.
  let calls = 0;
  endSession(() => null, () => {}, async () => { calls++; });
  assert.equal(calls, 0);

  // A failed request (offline, already dead) never surfaces.
  endSession(() => 'tok-2', () => {}, () => Promise.reject(new Error('offline')));
  await new Promise((r) => setTimeout(r, 0));

  // The frontend keeps a copy (it has no test runner): from the endSession
  // function to the end it must stay identical to this tested file.
  const logic = (file: string) => {
    const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    return src.slice(src.indexOf('export function endSession'));
  };
  assert.equal(
    logic(path.join(__dirname, '../../../frontend/src/lib/logoutRequest.ts')),
    logic(path.join(__dirname, 'logoutRequest.ts')),
    'frontend/src/lib/logoutRequest.ts has drifted from the tested backend copy',
  );

  console.log('logoutRequest.test.ts passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
