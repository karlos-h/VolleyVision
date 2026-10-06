/**
 * Copy of backend/src/lib/termsGate.ts (tested there; the frontend can't
 * import backend code and has no test runner of its own). Which signed-in
 * pages the Terms step takes over: all but deleting the account and live
 * tracking. Posting in chat stays gated by the server.
 *
 * ponytail: rule duplicated across the two packages, kept honest by the
 * backend file being the tested copy.
 */

const EXEMPT = [/^\/profile\/delete-account$/, /^\/matches\/[^/]+\/track\/?$/, /^\/track\/[^/]+\/?$/];

/** True when the Terms step replaces the page at this path. */
export const termsStepCovers = (pathname: string): boolean => !EXEMPT.some((route) => route.test(pathname));
