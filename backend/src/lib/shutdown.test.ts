import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installShutdown } from './shutdown';

function rig(closeCalls: boolean, hardExitMs = 10_000) {
  const proc = new EventEmitter();
  const calls: string[] = [];
  const server = { close: (cb: () => void) => { calls.push('close'); if (closeCalls) setImmediate(cb); } };
  installShutdown({
    server, hardExitMs, proc,
    disconnect: async () => { calls.push('disconnect'); },
    flush: async () => { calls.push('flush'); },
    exit: (code: number) => { calls.push(`exit${code}`); },
    log: () => {},
  });
  return { proc, calls };
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Order: stop accepting, disconnect, flush, exit 0; handlers registered once.
  let r = rig(true);
  r.proc.emit('SIGTERM');
  await tick();
  assert.deepEqual(r.calls, ['close', 'disconnect', 'flush', 'exit0']);

  // Close never calls back: the unref'd timer hard-exits 1.
  r = rig(false, 5);
  r.proc.emit('SIGINT');
  await tick();
  assert.deepEqual(r.calls, ['close', 'exit1']);

  // A second signal mid-shutdown exits at once.
  r = rig(false);
  r.proc.emit('SIGTERM');
  r.proc.emit('SIGTERM');
  assert.deepEqual(r.calls, ['close', 'exit1']);
  console.log('shutdown.test.ts passed');
}
main().catch((e) => { console.error(e); process.exit(1); });

// Source scan: index.ts must actually call both on the listening path (an audit
// found them imported and never used; nothing else would notice).
{
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../index.ts'), 'utf8');
  const listen = src.slice(src.indexOf('app.listen('));
  assert.ok(listen.includes('installShutdown({'), 'index.ts: installShutdown is not called after app.listen');
  assert.ok(listen.includes('startKeepAlive({'), 'index.ts: startKeepAlive is not called after app.listen');
}
console.log('shutdown.test.ts: wiring check passed');
