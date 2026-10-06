import assert from 'node:assert/strict';
import { describePool } from './dbPool';

const SECRET = 'postgresql://postgres.abc:hunter2@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

assert.equal(describePool(undefined), 'DATABASE_URL unset');
assert.equal(describePool(''), 'DATABASE_URL unset');
assert.equal(describePool('not a url'), 'DATABASE_URL unparseable');
assert.equal(describePool(SECRET), 'connection_limit=Prisma default (2×CPUs+1)');
assert.equal(describePool(`${SECRET}?pgbouncer=true`), 'connection_limit=Prisma default (2×CPUs+1), pgbouncer=true');
assert.equal(describePool(`${SECRET}?pgbouncer=true&connection_limit=3`), 'connection_limit=3, pgbouncer=true');
assert.equal(describePool(`${SECRET}?connection_limit=1`), 'connection_limit=1');
assert.equal(describePool(`${SECRET}?connection_limit=abc`), 'connection_limit=Prisma default (2×CPUs+1)', 'a non-number is not a limit');
// Never the URL, the host or the password.
for (const u of [SECRET, `${SECRET}?connection_limit=1`]) {
  const out = describePool(u);
  assert.ok(!out.includes('hunter2') && !out.includes('supabase') && !out.includes('postgres.abc'), out);
}
console.log('dbPool.test.ts passed');
