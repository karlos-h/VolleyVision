/**
 * Whether main.tsx may start Sentry. Tested copy:
 * backend/src/lib/sentryInit.frontendCopy.ts (logic below the marker must stay
 * identical; backend/src/lib/sentryInit.test.ts checks it).
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
