/**
 * Tested copy of frontend/src/lib/sentryInit.ts (the frontend has no test
 * runner): from the marker to the end the two files must stay identical;
 * sentryInit.test.ts checks it.
 */
export function shouldInitSentry(env: {
  DEV: boolean;
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
}): boolean {
  if (!env.VITE_SENTRY_DSN) return false;
  // The dev server is a laptop: report only when someone sets an environment
  // on purpose to test Sentry.
  return !env.DEV || !!env.VITE_SENTRY_ENVIRONMENT;
}
