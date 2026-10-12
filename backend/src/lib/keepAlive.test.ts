import assert from 'node:assert/strict';
import { startKeepAlive } from './keepAlive';

async function main() {
  let n = 0;
  const stop = startKeepAlive({ ping: async () => { n++; throw new Error('db paused'); }, intervalMs: 5, log: () => {} });
  await new Promise((r) => setTimeout(r, 60));
  stop();
  assert.ok(n >= 2, `pinged ${n}`);
  const after = n;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(n, after, 'stopped');
  console.log('keepAlive.test.ts passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
