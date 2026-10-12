// 9.6.R4: runSerializable on real Postgres. Two transactions read the same row
// and each writes read+1 (a lost update unless serialized). Postgres aborts one;
// retryOnConflict re-runs it once, so both land and the counter is exact.
import assert from 'node:assert/strict';
import { prisma, makeUser, cleanup } from './harness';
import { runSerializable } from '../lib/prisma';

async function main() {
  try {
    const u = await makeUser('ser');
    // Open the pool's second connection before the timed transactions start.
    await Promise.all([prisma.$queryRaw`SELECT 1`, prisma.$queryRaw`SELECT 1`]);
    let attempts = 0;
    let readers = 0;
    let release: () => void = () => {};
    const bothRead = new Promise<void>((r) => { release = r; });

    const bump = () => runSerializable(async (tx) => {
      attempts++;
      const row = await tx.user.findUniqueOrThrow({ where: { id: u.id }, select: { tokenVersion: true } });
      // Only the first attempts must overlap; a retry runs alone.
      if (++readers <= 2) {
        if (readers === 2) release();
        await bothRead;
      }
      await tx.user.update({ where: { id: u.id }, data: { tokenVersion: row.tokenVersion + 1 } });
    });

    await Promise.all([bump(), bump()]);

    const { tokenVersion } = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { tokenVersion: true } });
    assert.equal(tokenVersion, 2, 'no lost update');
    assert.equal(attempts, 3, 'one transaction was aborted and retried');

    console.log('serializable: all tests passed');
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
