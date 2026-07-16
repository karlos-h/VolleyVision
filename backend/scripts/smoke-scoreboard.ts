/**
 * End-to-end smoke test for the live scoreboard's score mutations.
 *
 * Manual End Set / Undo Set were withdrawn after hands-on testing (End Set is
 * commented out in controllers/matches.ts for possible future use; Undo Set is
 * gone). What's left to protect is:
 *   - automatic set completion at 25 / 15 win-by-2 still fires,
 *   - Undo Event undoes the last stat event and nothing more,
 *   - Reset Match still clears sets won and the whole history,
 *   - Reset Match's manualScoreOverride still shields set state from the
 *     replay that Undo Event would otherwise trigger.
 *
 * Boots the real Express app in-process, mints a real JWT, and asserts over
 * HTTP. Idempotent: creates its own throwaway user/team/match and deletes them.
 *
 *   npx ts-node scripts/smoke-scoreboard.ts
 */
process.env.PORT = process.env.SMOKE_PORT ?? '3998';
import { prisma } from '../src/lib/prisma';
import { generateToken } from '../src/services/auth.service';

const BASE = `http://localhost:${process.env.PORT}/api/v1`;
let failures = 0;

function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : `  — ${detail}`}`);
  if (!cond) failures++;
}

async function req(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* 204 etc */ }
  return { status: res.status, json };
}

type SetScore = { set: number; home: number; away: number };

const EMAIL = 'smoke.scoreboard@vv.test';
const TEAM = 'Smoke Scoreboard';

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, firstName: 'Board', lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });
  const team = await prisma.team.create({ data: { name: TEAM, season: '2026', ownerId: owner.id } });
  const match = await prisma.match.create({
    data: {
      teamId: team.id, opponent: 'Smoke Opponent', matchDate: new Date(),
      status: 'IN_PROGRESS', homeScore: 0, awayScore: 0, homeSetsWon: 0, awaySetsWon: 0, setScores: [],
    },
  });
  const player = await prisma.player.create({
    data: { firstName: 'Smoke', lastName: 'Player', jerseyNumber: 7, position: 'OUTSIDE_HITTER', teamId: team.id },
  });

  const token = generateToken({ userId: owner.id, email: owner.email, role: owner.role });

  await import('../src/index');
  await new Promise((r) => setTimeout(r, 1200));

  const read = async () => (await req('GET', `/matches/${match.id}`, token)).json;
  const setScore = (home: number, away: number) =>
    req('PATCH', `/matches/${match.id}/score`, token, { homeScore: home, awayScore: away });
  const kill = (setNumber: number) =>
    req('POST', '/events', token, { matchId: match.id, playerId: player.id, eventType: 'KILL', setNumber });

  // ── The withdrawn routes are actually gone ──
  console.log('\n── Withdrawn manual-override routes ──');
  const endSetRes = await req('POST', `/matches/${match.id}/score/end-set`, token);
  check('POST score/end-set → 404 (route not registered)', endSetRes.status === 404, `got ${endSetRes.status}`);
  const undoSetRes = await req('POST', `/matches/${match.id}/score/undo-set`, token);
  check('POST score/undo-set → 404 (route removed)', undoSetRes.status === 404, `got ${undoSetRes.status}`);

  // ── Automatic completion still fires at 25, win by 2 ──
  console.log('\n── Automatic set completion (25, win by 2) ──');
  await setScore(24, 24);
  await kill(1);
  const at2524 = await read();
  check('25-24 does NOT complete the set (1-point lead)',
    at2524.homeSetsWon === 0 && (at2524.setScores as SetScore[]).length === 0,
    `sets=${at2524.homeSetsWon} history=${JSON.stringify(at2524.setScores)}`);

  await kill(1);
  const at2624 = await read();
  check('26-24 completes the set', at2624.homeSetsWon === 1, `got ${at2624.homeSetsWon}`);
  check('completed set is banked with its real score',
    (at2624.setScores as SetScore[])[0]?.home === 26 && (at2624.setScores as SetScore[])[0]?.away === 24,
    JSON.stringify(at2624.setScores));
  check('running score resets for the next set',
    at2624.homeScore === 0 && at2624.awayScore === 0);

  // ── Automatic completion in the deciding set uses 15, not 25 ──
  console.log('\n── Automatic set completion (deciding set, 15) ──');
  await prisma.match.update({
    where: { id: match.id },
    data: {
      homeSetsWon: 2, awaySetsWon: 2, homeScore: 0, awayScore: 0,
      setScores: [
        { set: 1, home: 26, away: 24 }, { set: 2, home: 20, away: 25 },
        { set: 3, home: 25, away: 20 }, { set: 4, home: 20, away: 25 },
      ],
    },
  });
  await setScore(14, 5);
  await kill(5);
  const at155 = await read();
  check('15-5 completes the deciding set', at155.homeSetsWon === 3, `got ${at155.homeSetsWon}`);
  check('third set won completes the match', at155.status === 'COMPLETED', `got ${at155.status}`);
  check('deciding set banked', (at155.setScores as SetScore[]).length === 5);

  // ── Reset Match ──
  console.log('\n── Reset Match (from a completed 3-2 match) ──');
  const reset = await req('POST', `/matches/${match.id}/score/reset-match`, token);
  check('reset-match → 200', reset.status === 200, `got ${reset.status}`);
  check('sets won zeroed', reset.json?.homeSetsWon === 0 && reset.json?.awaySetsWon === 0);
  check('running score zeroed', reset.json?.homeScore === 0 && reset.json?.awayScore === 0);
  check('set history cleared', (reset.json?.setScores as SetScore[])?.length === 0, JSON.stringify(reset.json?.setScores));
  check('completed match reopened', reset.json?.status === 'IN_PROGRESS', `got ${reset.json?.status}`);
  check('marks the match manually overridden', reset.json?.manualScoreOverride === true);

  // ── Undo Event undoes the last stat event, not a set ──
  console.log('\n── Undo Event (in its new bottom-row slot) ──');
  const before = await read();
  // Reset Match zeroes the score but deliberately keeps the recorded stats, so
  // the log still holds the kills from the completion phases above.
  const eventCount = async () => (await req('GET', `/events/by-match/${match.id}`, token)).json.length;
  const eventsBefore = await eventCount();

  await kill(1);
  const afterKill = await read();
  check('recording a kill adds a point', afterKill.homeScore === before.homeScore + 1,
    `${before.homeScore} → ${afterKill.homeScore}`);
  check('recording a kill adds an event', (await eventCount()) === eventsBefore + 1);

  const undo = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo event → 200', undo.status === 200, `got ${undo.status}`);
  const afterUndo = await read();
  check('undo reverses exactly that point', afterUndo.homeScore === before.homeScore,
    `expected ${before.homeScore}, got ${afterUndo.homeScore}`);
  check('undo removes exactly one event', (await eventCount()) === eventsBefore,
    `expected ${eventsBefore}`);
  check('undo does NOT touch sets won', afterUndo.homeSetsWon === 0 && afterUndo.awaySetsWon === 0);
  // The real prize: the surviving kills above would rebuild set state if a
  // replay ran, so this proves manualScoreOverride is still shielding it.
  check('undo does NOT resurrect the reset set history',
    (afterUndo.setScores as SetScore[]).length === 0, JSON.stringify(afterUndo.setScores));

  // ── Cleanup ──
  await prisma.team.delete({ where: { id: team.id } }); // cascades match/players/events
  await prisma.user.delete({ where: { email: EMAIL } });

  console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.team.deleteMany({ where: { name: TEAM } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: EMAIL } }).catch(() => {});
  process.exit(1);
});
