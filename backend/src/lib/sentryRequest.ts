import type { RequestHandler } from 'express';
import { scrubUrl } from './scrubUrl';
import { clientTag } from './clientVersion';

// Same fold as netlify-functions/api.js: ids would make every request its own
// transaction group in Sentry.
const CUID_SEGMENT = /\/c[a-z0-9]{24}(?=\/|$)/g;

/** Exported for sentryScrub: Sentry's own Express instrumentation may rename
 * the transaction after this middleware ran, so the scrub folds ids again. */
export const foldIds = (path: string): string => path.replace(CUID_SEGMENT, '/:id');

export function transactionName(method: string, path: string): string {
  return `${method} ${foldIds(scrubUrl(path))}`;
}

type SentryLike = {
  getCurrentScope(): { setTransactionName(name: string): unknown };
  setTag(key: string, value: string): void;
};

// api.js did this per Lambda invocation; on a plain server @sentry/node's Express
// integration already isolates the scope per request, so only name it and tag it.
export const sentryRequestScope = (sentry: SentryLike): RequestHandler => (req, _res, next) => {
  sentry.getCurrentScope().setTransactionName(transactionName(req.method, req.originalUrl));
  sentry.setTag('client', clientTag(req.headers));
  next();
};
