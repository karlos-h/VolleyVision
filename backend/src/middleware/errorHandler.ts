import { Request, Response, NextFunction } from 'express';
import { mapErrorToResponse } from '../lib/mapError';
import { markFlushNeeded } from '../lib/sentryFlush';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    // Machine-readable discriminator for responses a client needs to branch
    // on (e.g. EMAIL_NOT_VERIFIED) rather than string-match the message.
    // Optional and additive — every existing AppError without one keeps
    // returning exactly { error } as before.
    public code?: string,
    // Extra fields for the response body (e.g. `teams` on ACCOUNT_HAS_TEAMS).
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const { status, body } = mapErrorToResponse(err);
  if (status === 500) console.error('Unhandled error:', err);
  // Sentry's Express handler ran just before us and captures whatever its
  // own status rule says is a server error: the error's status/statusCode,
  // or 500 when it has none (a plain Error, a Prisma P2002 we answer with
  // 409). Its beforeSend fires too late for the function's flush decision
  // (lib/sentryFlush.ts), so mirror that rule here.
  const own = (err as any).status ?? (err as any).statusCode;
  if (typeof own !== 'number' || own >= 500) markFlushNeeded();
  res.status(status).json(body);
}
