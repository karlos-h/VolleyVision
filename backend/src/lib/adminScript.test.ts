// 9.0.8: admin scripts that write (scrub-deleted-messages, and delete-account
// in 9.4) must never reach production by accident. Prisma and dotenv fill an
// unset DATABASE_URL from backend/.env, which is production.
import assert from 'node:assert/strict';
import { adminScriptTarget, confirmsProdApply, needsProdConfirmation, projectRef } from './adminScript';

const LOCAL = 'postgresql://ci:ci@localhost:55433/ci';
const err = (r: ReturnType<typeof adminScriptTarget>) => ('error' in r ? r.error : null);

// Without --prod: an explicit local database, or nothing.
assert.ok(err(adminScriptTarget([], {})), 'unset DATABASE_URL is refused (it would fall through to production)');
assert.ok(err(adminScriptTarget(['--apply'], { DATABASE_URL: 'postgresql://u:p@db.abc.supabase.co:5432/postgres' })), 'a remote database needs --prod');
assert.ok(err(adminScriptTarget([], { DATABASE_URL: LOCAL, DIRECT_URL: 'postgresql://u:p@db.abc.supabase.co/postgres' })), 'both URLs must be local');
const local = adminScriptTarget(['--apply'], { DATABASE_URL: LOCAL });
assert.deepEqual(local, {
  apply: true, prod: false,
  // Local runs never touch real storage or send real email: blanked, so
  // dotenv and Prisma can't fill them from backend/.env (production).
  env: { DIRECT_URL: LOCAL, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' },
});
assert.deepEqual(adminScriptTarget([], { DATABASE_URL: LOCAL }), { apply: false, prod: false, env: { DIRECT_URL: LOCAL, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' } }, 'a dry run by default');

// --prod: backend/.env, said out loud.
assert.deepEqual(adminScriptTarget(['--prod'], {}), { apply: false, prod: true, env: {} });
assert.deepEqual(adminScriptTarget(['--prod', '--apply'], {}), { apply: true, prod: true, env: {} });

// 9.5.0.7: --prod means backend/.env, but dotenv never overrides a variable
// the shell already set, so a preset URL would win while the script used
// production's mail and storage keys. Refused, whichever of the two is set.
const REMOTE = 'postgresql://u:p@db.abc.supabase.co:5432/postgres';
assert.ok(err(adminScriptTarget(['--prod'], { DATABASE_URL: REMOTE })), '--prod with DATABASE_URL already set is refused');
assert.ok(err(adminScriptTarget(['--prod', '--apply'], { DIRECT_URL: LOCAL })), '--prod with DIRECT_URL already set is refused');
assert.ok(err(adminScriptTarget(['--prod'], { DATABASE_URL: LOCAL, DIRECT_URL: LOCAL })), 'even a local one');
assert.deepEqual(adminScriptTarget(['--prod'], { DATABASE_URL: '' }), { apply: false, prod: true, env: {} }, 'an empty value counts as unset');

// --prod --apply asks for the printed project ref to be typed back; nothing
// else asks. A blank, a near miss or an unknown ref is a no.
const prodApply = { prod: true, apply: true };
assert.equal(confirmsProdApply(prodApply, 'rkkhrmhorgdqkxflipui', 'rkkhrmhorgdqkxflipui'), true);
assert.equal(confirmsProdApply(prodApply, 'rkkhrmhorgdqkxflipui', '  rkkhrmhorgdqkxflipui \n'), true, 'surrounding spaces are fine');
assert.equal(confirmsProdApply(prodApply, 'rkkhrmhorgdqkxflipui', 'rkkhrmhorgdqkxflipu'), false);
assert.equal(confirmsProdApply(prodApply, 'rkkhrmhorgdqkxflipui', 'yes'), false);
assert.equal(confirmsProdApply(prodApply, 'rkkhrmhorgdqkxflipui', ''), false);
assert.equal(confirmsProdApply(prodApply, 'rkkhrmhorgdqkxflipui', null), false, 'no answer (stdin closed)');
assert.equal(confirmsProdApply(prodApply, 'unknown', 'unknown'), false, 'an unreadable URL never confirms');
assert.equal(needsProdConfirmation({ prod: true, apply: true }), true);
for (const t of [{ prod: true, apply: false }, { prod: false, apply: true }, { prod: false, apply: false }]) {
  assert.equal(needsProdConfirmation(t), false, `no prompt for ${JSON.stringify(t)}`);
  assert.equal(confirmsProdApply(t, 'localhost', null), true);
}

// The project ref, never the URL (it holds the password).
assert.equal(projectRef('postgresql://postgres.abcdefgh:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres'), 'abcdefgh');
assert.equal(projectRef('postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres'), 'abcdefgh');
assert.equal(projectRef(LOCAL), 'localhost');
assert.equal(projectRef('not a url'), 'unknown');
assert.equal(projectRef(undefined), 'unknown');

console.log('adminScript.test.ts passed');
