import { Request, Response, NextFunction } from 'express';

// Team Chat — per-user token bucket on the two message POST endpoints, so a
// runaway client (or a held-down Enter key) can't flood a channel. In-memory
// is fine for the single-process backend; revisit if the API is ever
// horizontally scaled.

const CAPACITY = 10; // burst
const REFILL_PER_MS = 2 / 1000; // sustained ~2 messages/second

const buckets = new Map<string, { tokens: number; last: number }>();

export function chatPostRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { next(); return; } // requireAuth handles the 401
  const now = Date.now();
  const bucket = buckets.get(req.user.userId) ?? { tokens: CAPACITY, last: now };
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + (now - bucket.last) * REFILL_PER_MS);
  bucket.last = now;
  if (bucket.tokens < 1) {
    buckets.set(req.user.userId, bucket);
    res.status(429).json({ error: "You're sending messages too quickly — wait a moment and try again." });
    return;
  }
  bucket.tokens -= 1;
  buckets.set(req.user.userId, bucket);
  next();
}
