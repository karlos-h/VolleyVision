/**
 * Which signed-in pages the Terms step (9.3) takes over while a user still has
 * to accept updated Terms. Consumed by the SPA's RequireAuth
 * (frontend/src/lib/termsGate.ts carries a copy); it lives here because this is
 * where the repo can run a test (see homeTeams.ts's header).
 *
 * Exempt: deleting the account (declining the Terms mustn't trap anyone in an
 * account, Apple 5.1.1(v)) and live tracking (9.5.0.5): accepting needs a
 * connection, and a coach courtside must keep tracking if it drops. Posting in
 * chat stays gated server-side (assertTermsAccepted), which is what Play's UGC
 * rule needs; tracking isn't user-generated content.
 *
 * ponytail: rule duplicated across the two packages, kept honest by this file
 * being the tested copy.
 */

const EXEMPT = [/^\/profile\/delete-account$/, /^\/matches\/[^/]+\/track\/?$/, /^\/track\/[^/]+\/?$/];

/** True when the Terms step replaces the page at this path. */
export const termsStepCovers = (pathname: string): boolean => !EXEMPT.some((route) => route.test(pathname));
