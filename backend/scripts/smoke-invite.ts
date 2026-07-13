/**
 * Verifies invitation creation degrades gracefully when SMTP is unconfigured:
 * the invitation is still created, gets a join code, and reports emailSent=false
 * without throwing. Idempotent; cleans up after itself.
 */
import { prisma } from '../src/lib/prisma';
import { createInvitation, redeemInvitationByCode } from '../src/services/invitation.service';

async function main() {
  const inviter = await prisma.user.upsert({
    where: { email: 'smoke.inviter@vv.test' },
    update: {},
    create: { email: 'smoke.inviter@vv.test', firstName: 'Invy', lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });
  const invitee = await prisma.user.upsert({
    where: { email: 'smoke.invitee@vv.test' },
    update: {},
    create: { email: 'smoke.invitee@vv.test', firstName: 'Invitee', lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });
  const team = await prisma.team.create({ data: { name: 'Smoke Invite', season: '2026', ownerId: inviter.id } });

  let failures = 0;
  const check = (name: string, cond: boolean, detail = '') => {
    console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : `  — ${detail}`}`);
    if (!cond) failures++;
  };

  const inv: any = await createInvitation(team.id, inviter.id, 'smoke.invitee@vv.test', 'PLAYER');
  check('invitation created', !!inv?.id);
  check('join code generated', typeof inv.joinCode === 'string' && inv.joinCode.length >= 6, `code=${inv.joinCode}`);
  check('emailSent=false when SMTP unconfigured (no throw)', inv.emailSent === false, `emailSent=${inv.emailSent}`);

  // Redeem by code works for the matching user.
  const redeemed = await redeemInvitationByCode(inv.joinCode, invitee.id);
  check('redeem by code creates membership', !!redeemed?.id);
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: invitee.id, teamId: team.id } },
  });
  check('membership row exists after redeem', !!membership);

  // Cleanup
  await prisma.team.delete({ where: { id: team.id } });
  await prisma.user.deleteMany({ where: { email: { in: ['smoke.inviter@vv.test', 'smoke.invitee@vv.test'] } } });

  console.log(`\n${failures === 0 ? 'INVITE SMOKE PASSED' : `${failures} INVITE CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
