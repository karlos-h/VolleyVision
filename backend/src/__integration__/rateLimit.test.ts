// 9.5.6 on real Postgres: the shared token buckets keep their exact semantics
// under concurrency — never more than `max` admitted, multi-key stays
// all-or-nothing and deadlock-free, a rejection writes nothing, and the stored
// state is exactly what the pure refill()/fullAt() in rateLimit.ts say it is.
// The limiter is built directly: makeLimiter only picks it in production.
import './requireLocalDb'; // first: refuses a non-local DB before Prisma loads
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { PostgresRateLimiter } from '../lib/postgresRateLimit';
import { fullAt, refill } from '../lib/rateLimit';

const RUN = `rl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const key = (name: string) => `${RUN}:${name}`;
const HOUR = 3_600_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Any console.error from the limiter means it fell back to in-memory buckets
// (or the sweep failed), which would make every count below meaningless.
const errors: unknown[][] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => { errors.push(args); originalError(...args); };
const noFallback = (label: string) => assert.equal(errors.length, 0, `${label}: limiter logged an error / fell back`);

type Row = { tokens: number; updated_at: Date; full_at: Date; xmin: string };
async function row(k: string): Promise<Row | undefined> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "tokens", "updated_at", "full_at", xmin::text AS xmin FROM "rate_limit_buckets" WHERE "key" = ${k}`;
  return rows[0];
}

async function admitted(calls: Promise<boolean>[]): Promise<number> {
  return (await Promise.all(calls)).filter(Boolean).length;
}

async function main() {
  try {
    // (a) Parallel admission across two instances (two Function invocations).
    for (const max of [5, 1]) {
      const k = key(`parallel-${max}`);
      const a = new PostgresRateLimiter({ max, windowMs: HOUR });
      const b = new PostgresRateLimiter({ max, windowMs: HOUR });
      const n = await admitted(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).tryConsume(k)));
      assert.equal(n, max, `max=${max}: exactly max admitted`);
      const r = await row(k);
      assert.ok(r && r.tokens >= 0 && r.tokens < 1, `max=${max}: tokens ${r?.tokens} in [0, 1)`);
      noFallback(`(a) max=${max}`);
    }

    // (b) Multi-key with one key drained: rejected, and the other key untouched.
    {
      const max = 3;
      const lim = new PostgresRateLimiter({ max, windowMs: HOUR });
      const [A, B] = [key('multi-A'), key('multi-B')];
      for (let i = 0; i < max; i++) assert.equal(await lim.tryConsume(B), true);
      assert.equal(await lim.tryConsume([A, B]), false, '[A, B] rejected while B is drained');
      const r = await row(A);
      assert.ok(r === undefined || r.tokens === max, `A absent or full, got ${r?.tokens}`);
      for (let i = 0; i < max; i++) assert.equal(await lim.tryConsume(A), true, `A alone admits #${i + 1}`);
      assert.equal(await lim.tryConsume(A), false);
      noFallback('(b)');
    }

    // (c) Multi-key under contention, keys in both orders: exactly max in
    // total and no fallback, so no deadlock.
    {
      const max = 5;
      const [A, B] = [key('cont-A'), key('cont-B')];
      const a = new PostgresRateLimiter({ max, windowMs: HOUR });
      const b = new PostgresRateLimiter({ max, windowMs: HOUR });
      const n = await admitted(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).tryConsume(i % 2 ? [A, B] : [B, A])));
      assert.equal(n, max, 'exactly max admitted across [A, B] and [B, A]');
      noFallback('(c)');
    }

    // (d) Refill over time: 2 per 2 s is one token a second.
    {
      const k = key('refill');
      const lim = new PostgresRateLimiter({ max: 2, windowMs: 2000 });
      assert.equal(await lim.tryConsume(k), true);
      assert.equal(await lim.tryConsume(k), true);
      assert.equal(await lim.tryConsume(k), false, 'drained');
      await sleep(1100);
      assert.equal(await lim.tryConsume(k), true, 'one token back after 1.1 s');
      assert.equal(await lim.tryConsume(k), false, 'and only one');
      noFallback('(d)');
    }

    // (e) A rejected call changes nothing.
    {
      const k = key('reject');
      const lim = new PostgresRateLimiter({ max: 2, windowMs: HOUR });
      assert.equal(await lim.tryConsume(k), true);
      assert.equal(await lim.tryConsume(k), true);
      const before = await row(k);
      assert.equal(await lim.tryConsume(k), false);
      const after = await row(k);
      assert.ok(before && after);
      assert.equal(after.tokens, before.tokens);
      assert.equal(after.updated_at.getTime(), before.updated_at.getTime());
      assert.equal(after.full_at.getTime(), before.full_at.getTime());
      // The single-key upsert's WHERE fails, so not even a new row version.
      assert.equal(after.xmin, before.xmin, 'no new row version');
      noFallback('(e)');
    }

    // (f) Parity with the pure maths: the stored bucket is refill() minus one,
    // exactly, and full_at is fullAt() of it to the millisecond the column
    // keeps — on a fresh key and a part-spent one, single- and multi-key.
    {
      const max = 10;
      const windowMs = 10_000;
      const refillPerMs = max / windowMs;
      const k = key('parity');
      const lim = new PostgresRateLimiter({ max, windowMs });
      const check = (before: Row | undefined, after: Row, label: string) => {
        const now = after.updated_at.getTime();
        const prior = before && { tokens: before.tokens, last: before.updated_at.getTime() };
        assert.equal(after.tokens, refill(prior, now, max, refillPerMs).tokens - 1, `${label}: tokens`);
        const expectedFull = fullAt({ tokens: after.tokens, last: now }, max, refillPerMs);
        assert.ok(Math.abs(after.full_at.getTime() - expectedFull) <= 1, `${label}: full_at ${after.full_at.getTime()} vs ${expectedFull}`);
      };

      assert.equal(await lim.tryConsume(k), true);
      check(undefined, (await row(k))!, 'fresh key');
      for (let i = 0; i < 4; i++) assert.equal(await lim.tryConsume(k), true);
      await sleep(150);
      const before = await row(k);
      assert.equal(await lim.tryConsume(k), true);
      check(before, (await row(k))!, 'part-spent key');

      const [P, Q] = [key('parity-P'), key('parity-Q')];
      assert.equal(await lim.tryConsume([P, Q]), true);
      check(undefined, (await row(P))!, 'multi-key fresh');
      await sleep(150);
      const [bp, bq] = [await row(P), await row(Q)];
      assert.equal(await lim.tryConsume([Q, P]), true);
      check(bp, (await row(P))!, 'multi-key part-spent P');
      check(bq, (await row(Q))!, 'multi-key part-spent Q');
      noFallback('(f)');
    }

    // (g) A fresh max=1 key admits its first call: refill(undefined) is full.
    // Before 9.5.6 the read-back clock could trail the stored, rounded one by
    // up to 1 ms, and about half of these were refused.
    {
      const windowMs = 60_000;
      const lim = new PostgresRateLimiter({ max: 1, windowMs });
      for (let i = 0; i < 20; i++) {
        const k = key(`fresh-${i}`);
        assert.equal(await lim.tryConsume(k), true, `fresh key ${i}`);
        const r = (await row(k))!;
        assert.equal(r.tokens, 0);
        assert.equal(r.full_at.getTime(), fullAt({ tokens: 0, last: r.updated_at.getTime() }, 1, 1 / windowMs));
      }
      noFallback('(g)');
    }

    console.log('rateLimit: all tests passed');
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `${RUN}:` } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  originalError(err);
  process.exit(1);
});
