/**
 * Grant global ADMIN to a user by email.
 *
 *   npx ts-node scripts/ensure-admin.ts you@example.com
 *
 * ADMIN bypasses team-visibility checks (Stabilization Pass 2) and gates the
 * admin-only league endpoints. Idempotent — safe to re-run.
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: ts-node scripts/ensure-admin.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}". Nothing changed.`);
    process.exit(1);
  }

  if (user.role === 'ADMIN') {
    console.log(`${email} is already ADMIN.`);
    return;
  }

  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  console.log(`${email} is now ADMIN (was ${user.role}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
