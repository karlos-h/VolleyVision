import { isNative } from './native';

// The legal pages are static files on the website (9.2), outside the SPA: plain
// <a href>, never a router <Link> (the catch-all route would send it home). In
// the apps the link is absolute, so it opens in the phone's browser instead of
// replacing the app. One spot for the address. volleyvision.co.nz (Karlos, 1 Oct)
// isn't bought yet, so the apps use the netlify.app address, which always works.
// Flip DOMAIN_LIVE (and SUPPORT_EMAIL_CONFIRMED below) in one commit once the
// domain points at the Netlify site (docs/domain-setup.md); check-legal.mjs
// refuses the domain address while this is false.
const DOMAIN_LIVE = false;
export const SITE_URL = DOMAIN_LIVE ? 'https://volleyvision.co.nz' : 'https://volleyvision-app.netlify.app';

export type LegalPage = 'privacy' | 'terms' | 'delete-account' | 'support';

/** The pages linked from the avatar menu and the signed-out footer. */
export const LEGAL_LINKS: readonly [LegalPage, string][] = [['privacy', 'Privacy'], ['terms', 'Terms'], ['support', 'Support']];

// The one config spot for the legal details (9.2). The static pages in
// public/ repeat them, and scripts/check-legal.mjs fails CI if they differ.
export const LEGAL_ENTITY = 'Himex Trading Ltd';
export const SUPPORT_EMAIL = 'support@volleyvision.co.nz';
/** True once Karlos has confirmed the mailbox receives mail. check-legal --release
 *  (prod deploys, store builds) refuses to run until then: the delete and support
 *  pages tell users to write to it. */
export const SUPPORT_EMAIL_CONFIRMED = false;
/** Equals CURRENT_TERMS_VERSION in backend/src/lib/terms.ts and the date on terms.html. */
export const TERMS_VERSION = '2026-10-01';

export const legalHref = (page: LegalPage): string => (isNative() ? `${SITE_URL}/${page}` : `/${page}`);
