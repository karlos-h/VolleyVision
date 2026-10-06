// The wrapper must not stop an error reaching Sentry's transport. Real SDK,
// mock transport; instrument.ts is not imported (it runs dotenv).
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/node';
import { scrubRequest } from '../lib/sentryScrub';
import { wrapBeforeSend, takeFlushNeeded } from '../lib/sentryFlush';

async function main() {
  const envelopes: unknown[] = [];
  Sentry.init({
    dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    transport: () => ({
      send: async (envelope: unknown) => {
        envelopes.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
    beforeSend: wrapBeforeSend(scrubRequest),
    tracesSampleRate: 0,
  });

  assert.equal(takeFlushNeeded(), false);
  Sentry.captureException(new Error('boom'));
  await Sentry.flush(2000);
  // Count event envelopes only: the SDK may also send a session or client-report
  // envelope on the same flush (it did on the Linux CI runner, not on Windows).
  const events = envelopes.filter((env) => (env as [unknown, Array<[{ type?: string }, unknown]>])[1]?.some(([h]) => h?.type === 'event'));
  assert.equal(events.length, 1, `error reached the transport (envelopes: ${envelopes.length})`);
  assert.equal(takeFlushNeeded(), true);
  assert.equal(takeFlushNeeded(), false, 'nothing captured since');

  await Sentry.close(2000);
  console.log('sentryFlush.transport: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
