// Per-request Server-Timing (Phase 9.5.1: measure before optimising) and the
// request-scoped store a later step's memo will hang off.
//
// Its own module, importing nothing from the app, because installFakePrisma
// swaps lib/prisma out of require.cache: the fake must still be able to count
// operations here.
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

export interface RequestStore {
  start: number;
  dbOps: number;
  dbMs: number;
  memo: Map<string, Promise<unknown>> | null;
}

const als = new AsyncLocalStorage<RequestStore>();

export function withRequestStore<T>(fn: () => T): T {
  return als.run({ start: performance.now(), dbOps: 0, dbMs: 0, memo: new Map() }, fn);
}

export function getRequestStore(): RequestStore | undefined {
  return als.getStore();
}

export function noteDbOperation(_operation: string): RequestStore | undefined {
  const store = als.getStore();
  if (store) store.dbOps++;
  // 9.5.4: a write (by operation name) will poison the memo here.
  return store;
}

/** Prisma `query.$allOperations` hook. */
export async function timeDbOperation(p: { operation: string; args: unknown; query: (args: any) => Promise<unknown> }): Promise<unknown> {
  const store = noteDbOperation(p.operation);
  const t0 = performance.now();
  // No await before this call: array-form $transaction([...]) needs each
  // PrismaPromise created synchronously, or the batch never forms.
  const pending = p.query(p.args);
  try {
    return await pending;
  } finally {
    if (store) store.dbMs += performance.now() - t0;
  }
}

export function formatServerTiming(s: { dbMs: number; dbOps: number; appMs: number; cold: boolean; region?: string }): string {
  let out = `db;dur=${Math.round(s.dbMs)};desc="ops=${s.dbOps}", app;dur=${Math.round(s.appMs)}, cold;desc="${s.cold ? 1 : 0}"`;
  // AWS_REGION is the only free text in the header; filtering it keeps a header
  // injection or a stray quote out even if the environment is odd.
  const region = (s.region ?? '').replace(/[^a-z0-9-]/g, '');
  if (region) out += `, fn;desc="${region}"`;
  return out;
}

// No switch to turn this on in production: the ops count differs between a
// hidden team's 404 and a missing one's, which would undo the 404-not-403 rule.
export function serverTimingEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.SENTRY_ENVIRONMENT === 'staging' || env.NODE_ENV !== 'production';
}

let cold = true;

export const requestContext: RequestHandler = (_req, res, next) => {
  withRequestStore(() => {
    const store = als.getStore()!;
    const wasCold = cold;
    cold = false;
    // Read per request so the off-in-production rule is testable in one process.
    if (serverTimingEnabled(process.env)) {
      const writeHead = res.writeHead;
      res.writeHead = function (this: typeof res, ...args: any[]) {
        try {
          if (!res.headersSent) {
            res.setHeader('Server-Timing', formatServerTiming({
              dbMs: store.dbMs, dbOps: store.dbOps, appMs: performance.now() - store.start, cold: wasCold, region: process.env.AWS_REGION,
            }));
          }
        } catch {
          // A timing header must never be why a response fails.
        }
        return (writeHead as (...a: any[]) => any).apply(this, args);
      } as typeof res.writeHead;
    }
    next();
  });
};
