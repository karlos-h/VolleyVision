// Proves check-legal.mjs still catches what it exists to catch: above all that
// --release refuses a support mailbox nobody has confirmed, and that the apps'
// legal links stay on the netlify.app address until the domain is live (9.5.0.1).
//   node scripts/check-legal.test.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const script = path.join(here, 'check-legal.mjs');

const SITE = "DOMAIN_LIVE ? 'https://volleyvision.co.nz' : 'https://volleyvision-app.netlify.app'";
const legalTs = ({ confirmed = 'true', domainLive = 'false', site = SITE, email = 'support@example.test', version = '2026-10-01' } = {}) => [
  confirmed === null ? '' : `export const SUPPORT_EMAIL_CONFIRMED = ${confirmed};`,
  domainLive === null ? '' : `const DOMAIN_LIVE = ${domainLive};`,
  `export const SITE_URL = ${site};`,
  "export const LEGAL_ENTITY = 'Himex Trading Ltd';",
  `export const SUPPORT_EMAIL = '${email}';`,
  `export const TERMS_VERSION = '${version}';`,
].join('\n');

const page = (extra = '') => `<p>Himex Trading Ltd, support@example.test</p>${extra}`;

function project({ legal = {}, backendVersion = '2026-10-01', pages = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'vv-legal-'));
  const front = path.join(root, 'frontend');
  mkdirSync(path.join(front, 'src/lib'), { recursive: true });
  mkdirSync(path.join(front, 'public'), { recursive: true });
  mkdirSync(path.join(root, 'backend/src/lib'), { recursive: true });
  writeFileSync(path.join(front, 'src/lib/legal.ts'), legalTs(legal));
  writeFileSync(path.join(root, 'backend/src/lib/terms.ts'), `export const CURRENT_TERMS_VERSION = '${backendVersion}';`);
  const html = {
    privacy: page(), 'delete-account': page(), support: page(),
    terms: page('<main data-terms-version="2026-10-01"></main>'),
    ...pages,
  };
  for (const [name, body] of Object.entries(html)) writeFileSync(path.join(front, 'public', `${name}.html`), body);
  return front;
}
const run = (front, ...flags) => spawnSync(process.execPath, [script, ...flags, front], { encoding: 'utf8' });

const cases = [
  // [name, project spec, exit without --release, exit with --release]
  ['a confirmed setup passes', {}, 0, 0],
  ['an unconfirmed support mailbox fails only --release', { legal: { confirmed: 'false' } }, 0, 1],
  ['a missing SUPPORT_EMAIL_CONFIRMED fails --release', { legal: { confirmed: null } }, 0, 1],
  ['the domain address while DOMAIN_LIVE is false fails', { legal: { site: "'https://volleyvision.co.nz'" } }, 1, 1],
  ['a missing DOMAIN_LIVE fails', { legal: { domainLive: null } }, 1, 1],
  ['the domain address once DOMAIN_LIVE is true passes', { legal: { domainLive: 'true' } }, 0, 0],
  ['an unparseable SITE_URL fails', { legal: { site: 'base + "/x"' } }, 1, 1],
  ['a SUPPORT_EMAIL_TBD placeholder fails --release', { legal: { email: 'SUPPORT_EMAIL_TBD' }, pages: Object.fromEntries(['privacy', 'delete-account', 'support'].map((p) => [p, '<p>Himex Trading Ltd, SUPPORT_EMAIL_TBD</p>'])) }, 1, 1],
  ['a TO CONFIRM in a page fails --release', { pages: { privacy: page('TO CONFIRM: region') } }, 0, 1],
  ['a page without the support email fails', { pages: { support: '<p>Himex Trading Ltd</p>' } }, 1, 1],
  ['Terms versions that differ fail', { backendVersion: '2026-09-01' }, 1, 1],
];

for (const [name, spec, plain, release] of cases) {
  const front = project(spec);
  const a = run(front);
  assert.equal(a.status, plain, `${name} (no --release): exit ${a.status}\n${a.stdout}${a.stderr}`);
  const b = run(front, '--release');
  assert.equal(b.status, release, `${name} (--release): exit ${b.status}\n${b.stdout}${b.stderr}`);
}

// The real tree must pass CI's plain run (the release run depends on Karlos
// confirming the mailbox, so it isn't asserted here).
const real = spawnSync(process.execPath, [script], { encoding: 'utf8' });
assert.equal(real.status, 0, `the real legal pages fail the plain check:\n${real.stdout}${real.stderr}`);

console.log(`check-legal.test.mjs passed (${cases.length * 2 + 1} cases)`);
