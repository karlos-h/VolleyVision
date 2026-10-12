/**
 * Whether instrument.ts may start Sentry. Local dev and `npm test` must not
 * report (10 of the first 14 issues were a laptop). NODE_ENV can be unset
 * inside Lambda, so "unset" only counts as local when no hosting marker is set.
 */
export function shouldInitSentry(env: Record<string, string | undefined>): boolean {
  if (!env.SENTRY_DSN) return false;
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv === 'development' || nodeEnv === 'test') return false;
  if (!nodeEnv) return !!(env.AWS_LAMBDA_FUNCTION_NAME || env.FLY_APP_NAME);
  return true;
}
