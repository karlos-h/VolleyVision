// The legal pages (public/*.html, 9.2) are static files Vite copies as they
// are, so they can't import the values in src/lib/legal.ts. This fails if the
// two disagree: the company, the support email, and the Terms version (also
// backend/src/lib/terms.ts, which decides who must accept again). It also keeps
// the apps' legal links on the netlify.app address until the domain is live.
//   node scripts/check-legal.mjs [--release] [frontend-dir]
// --release (Android release builds, Codemagic, deploy.ps1 prod) also refuses a
// support mailbox nobody has confirmed receives mail (SUPPORT_EMAIL_CONFIRMED),
// the SUPPORT_EMAIL_TBD placeholder and any "TO CONFIRM" left in a page.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// The directory argument exists for check-legal.test.mjs.
const front = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(here, '..');
const read = (p) => readFileSync(p, 'utf8');
const constant = (src, name) => new RegExp(`${name}\\s*=\\s*'([^']+)'`).exec(src)?.[1];
const flag = (src, name) => new RegExp(`${name}\\s*=\\s*(true|false)\\b`).exec(src)?.[1];

const legal = read(path.join(front, 'src/lib/legal.ts'));
const entity = constant(legal, 'LEGAL_ENTITY');
const email = constant(legal, 'SUPPORT_EMAIL');
const version = constant(legal, 'TERMS_VERSION');
const emailConfirmed = flag(legal, 'SUPPORT_EMAIL_CONFIRMED');
const domainLive = flag(legal, 'DOMAIN_LIVE');
const site = /SITE_URL\s*=\s*DOMAIN_LIVE\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(legal);
const backendVersion = constant(read(path.join(front, '../backend/src/lib/terms.ts')), 'CURRENT_TERMS_VERSION');
const release = process.argv.includes('--release');

const problems = [];
if (!entity || !email || !version) problems.push('src/lib/legal.ts: LEGAL_ENTITY, SUPPORT_EMAIL and TERMS_VERSION must all be set');
if (version !== backendVersion) problems.push(`Terms version ${version} in legal.ts, ${backendVersion} in backend/src/lib/terms.ts`);
if (release && /TBD/.test(email ?? '')) problems.push('the support email is still a placeholder (SUPPORT_EMAIL_TBD): set it in src/lib/legal.ts and the pages');
if (release && emailConfirmed !== 'true') problems.push(`nobody has confirmed ${email} receives mail: set SUPPORT_EMAIL_CONFIRMED = true in src/lib/legal.ts once it does`);
// The apps open SITE_URL in the phone's browser; a domain that doesn't resolve
// yet would make every legal link (Terms step, delete page) a dead end.
if (!domainLive || !site) problems.push("src/lib/legal.ts: DOMAIN_LIVE must be true or false, and SITE_URL = DOMAIN_LIVE ? '<domain>' : '<netlify.app>'");
else if (domainLive === 'false' && !/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(site[2])) problems.push(`SITE_URL must be the netlify.app address while DOMAIN_LIVE is false, not ${site[2]}`);

for (const page of ['privacy', 'terms', 'delete-account', 'support']) {
  const file = path.join(front, 'public', `${page}.html`);
  if (!existsSync(file)) { problems.push(`public/${page}.html is missing`); continue; }
  const html = read(file);
  if (entity && !html.includes(entity)) problems.push(`public/${page}.html doesn't name ${entity}`);
  if (email && !html.includes(email)) problems.push(`public/${page}.html doesn't give ${email}`);
  // Facts the code can't show are drafted as "TO CONFIRM"; none may ship.
  if (release && html.includes('TO CONFIRM')) problems.push(`public/${page}.html still has a TO CONFIRM`);
}
const terms = existsSync(path.join(front, 'public/terms.html')) ? read(path.join(front, 'public/terms.html')) : '';
if (version && !terms.includes(`data-terms-version="${version}"`)) problems.push(`public/terms.html isn't marked data-terms-version="${version}"`);

if (problems.length) {
  console.error(`Legal pages check FAILED:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Legal pages check passed: ${entity}, ${email}, Terms ${version}.`);
