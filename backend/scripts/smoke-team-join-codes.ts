/**
 * Verifies the reusable team join-code flow end to end at the service level:
 * lookup classification, player/staff redeem, role validation, duplicate
 * membership rejection, and regeneration invalidating the old code.
 * Idempotent; cleans up after itself.
 */
import { prisma } from '../src/lib/prisma';
import {
  generateTeamJoinCode,
  getTeamJoinCodes,
  regenerateTeamJoinCode,
  redeemTeamJoinCode,
  lookupCode,
} from '../src/services/teamJoinCode.service';

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: 'smoke.codeowner@vv.test' },
    update: {},
    create: { email: 'smoke.codeowner@vv.test', firstName: 'Owner', lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });
  const player = await prisma.user.upsert({
    where: { email: 'smoke.codeplayer@vv.test' },
    update: {},
    create: { email: 'smoke.codeplayer@vv.test', firstName: 'Player', lastName: 'Smoke', passwordHash: 'x', role: 'PLAYER' },
  });
  const staff = await prisma.user.upsert({
    where: { email: 'smoke.codestaff@vv.test' },
    update: {},
    create: { email: 'smoke.codestaff@vv.test', firstName: 'Staff', lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });

  const playerJoinCode = await generateTeamJoinCode('PLAYER');
  const staffJoinCode = await generateTeamJoinCode('STAFF');
  const team = await prisma.team.create({
    data: { name: 'Smoke Join Codes', season: '2026', ownerId: owner.id, playerJoinCode, staffJoinCode },
  });

  let failures = 0;
  const check = (name: string, cond: boolean, detail = '') => {
    console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : `  — ${detail}`}`);
    if (!cond) failures++;
  };
  const expectStatus = async (name: string, fn: () => Promise<unknown>, status: number) => {
    try {
      await fn();
      check(name, false, 'expected an error but none thrown');
    } catch (err: any) {
      check(name, err.statusCode === status, `statusCode=${err.statusCode} msg=${err.message}`);
    }
  };

  const codes = await getTeamJoinCodes(team.id);
  check('team has both codes', codes.playerJoinCode === playerJoinCode && codes.staffJoinCode === staffJoinCode);

  check('lookup player code', (await lookupCode(playerJoinCode)).kind === 'TEAM_PLAYER');
  check('lookup staff code (lowercase, padded)', (await lookupCode(` ${staffJoinCode.toLowerCase()} `)).kind === 'TEAM_STAFF');
  check('lookup unknown code', (await lookupCode('ZZZZZZZZ')).kind === null);

  const joined = await redeemTeamJoinCode(playerJoinCode.toLowerCase(), player.id);
  check('player code joins as PLAYER (role param ignored)', joined.role === 'PLAYER' && joined.team.id === team.id);
  await expectStatus('re-redeeming as existing member → 409', () => redeemTeamJoinCode(playerJoinCode, player.id), 409);

  await expectStatus('staff code without role → 400', () => redeemTeamJoinCode(staffJoinCode, staff.id), 400);
  await expectStatus('staff code with PLAYER role → 400', () => redeemTeamJoinCode(staffJoinCode, staff.id, 'PLAYER'), 400);
  const joinedStaff = await redeemTeamJoinCode(staffJoinCode, staff.id, 'ASSISTANT_COACH');
  check('staff code joins with picked role', joinedStaff.role === 'ASSISTANT_COACH');
  const staffMembership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: staff.id, teamId: team.id } },
  });
  check('staff membership row has picked role', staffMembership?.role === 'ASSISTANT_COACH');

  const newPlayerCode = await regenerateTeamJoinCode(team.id, 'PLAYER');
  check('regenerate returns a fresh code', newPlayerCode !== playerJoinCode);
  check('old code no longer resolves', (await lookupCode(playerJoinCode)).kind === null);
  check('new code resolves', (await lookupCode(newPlayerCode)).kind === 'TEAM_PLAYER');
  await expectStatus('redeeming the old code → 404', () => redeemTeamJoinCode(playerJoinCode, owner.id), 404);

  // Cleanup
  await prisma.team.delete({ where: { id: team.id } });
  await prisma.user.deleteMany({
    where: { email: { in: ['smoke.codeowner@vv.test', 'smoke.codeplayer@vv.test', 'smoke.codestaff@vv.test'] } },
  });

  console.log(`\n${failures === 0 ? 'TEAM JOIN CODE SMOKE PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
