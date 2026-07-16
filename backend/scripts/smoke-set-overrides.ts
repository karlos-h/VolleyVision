/**
 * End-to-end smoke test for the manual set overrides (End Set / Undo Set /
 * Reset Match) added alongside the LiveScoreboard rebuild.
 *
 * Boots the real Express app in-process, mints a real JWT, and asserts over
 * HTTP against a match that already has sets recorded — the fresh 0-0 case
 * hides most of the interesting behaviour. Idempotent: creates its own
 * throwaway user/team/match and deletes them at the end.
 *
 *   npx ts-node scripts/smoke-set-overrides.ts
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

const EMAIL = 'smoke.setops@vv.test';

async function main() {
  // ── Seed: a match mid-way through set 3, at 2 sets to 0 ──
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, firstName: 'SetOps', lastName: 'Smoke', passwordHash: 'x', role: 'COACH' },
  });
  const team = await prisma.team.create({
    data: { name: 'Smoke SetOps', season: '2026', ownerId: owner.id },
  });

  const startingSets: SetScore[] = [
    { set: 1, home: 25, away: 20 },
    { set: 2, home: 25, away: 22 },
  ];
  const match = await prisma.match.create({
    data: {
      teamId: team.id,
      opponent: 'Smoke Opponent',
      matchDate: new Date(),
      status: 'IN_PROGRESS',
      homeScore: 18,
      awayScore: 12,
      homeSetsWon: 2,
      awaySetsWon: 0,
      setScores: startingSets,
    },
  });

  const token = generateToken({ userId: owner.id, email: owner.email, role: owner.role });

  await import('../src/index');
  await new Promise((r) => setTimeout(r, 1200));

  const read = async () => (await req('GET', `/matches/${match.id}`, token)).json;

  // ── End Set: below threshold, mid-match ──
  console.log('\n── End Set (18-12, no threshold met, 2 sets already banked) ──');
  const ended = await req('POST', `/matches/${match.id}/score/end-set`, token);
  check('end-set → 200', ended.status === 200, `got ${ended.status} ${JSON.stringify(ended.json)}`);
  // Field-wise, not JSON.stringify — Postgres returns jsonb keys in its own order.
  const banked = (ended.json?.setScores as SetScore[])?.[2];
  check('records the real score, not the threshold',
    banked?.set === 3 && banked?.home === 18 && banked?.away === 12,
    JSON.stringify(ended.json?.setScores));
  check('awards the set to the leader (home 2 → 3)', ended.json?.homeSetsWon === 3, `got ${ended.json?.homeSetsWon}`);
  check('away sets untouched', ended.json?.awaySetsWon === 0);
  check('running score zeroed', ended.json?.homeScore === 0 && ended.json?.awayScore === 0);
  check('third set completes the match', ended.json?.status === 'COMPLETED', `got ${ended.json?.status}`);
  check('marks the match manually overridden', ended.json?.manualScoreOverride === true);
  check('earlier set history preserved',
    (ended.json?.setScores as SetScore[])?.length === 3);

  // ── Undo Set: must reopen the completed match ──
  console.log('\n── Undo Set (reverses the match-winning set) ──');
  const undone = await req('POST', `/matches/${match.id}/score/undo-set`, token);
  check('undo-set → 200', undone.status === 200, `got ${undone.status}`);
  check('set taken back off the winner (3 → 2)', undone.json?.homeSetsWon === 2, `got ${undone.json?.homeSetsWon}`);
  check('score restored so play resumes mid-set',
    undone.json?.homeScore === 18 && undone.json?.awayScore === 12,
    `got ${undone.json?.homeScore}-${undone.json?.awayScore}`);
  check('history popped back to 2 entries', (undone.json?.setScores as SetScore[])?.length === 2);
  check('match reopened to IN_PROGRESS', undone.json?.status === 'IN_PROGRESS', `got ${undone.json?.status}`);

  // ── End Set rejects a tie ──
  console.log('\n── End Set on a tied score ──');
  await req('PATCH', `/matches/${match.id}/score`, token, { homeScore: 15, awayScore: 15 });
  const tied = await req('POST', `/matches/${match.id}/score/end-set`, token);
  check('tied end-set → 400', tied.status === 400, `got ${tied.status}`);
  const afterTie = await read();
  check('tied end-set changed nothing', afterTie.homeSetsWon === 2 && (afterTie.setScores as SetScore[]).length === 2);

  // ── The override must survive an Undo Event ──
  console.log('\n── Undo Event must not erase the manual set history ──');
  await req('PATCH', `/matches/${match.id}/score`, token, { homeScore: 5, awayScore: 15 });
  const player = await prisma.player.create({
    data: { firstName: 'Smoke', lastName: 'Player', jerseyNumber: 7, position: 'LIBERO', teamId: team.id },
  });
  const recorded = await req('POST', '/events', token, {
    matchId: match.id, playerId: player.id, eventType: 'KILL', setNumber: 3,
  });
  check('event recorded → 201', recorded.status === 201, `got ${recorded.status}`);

  const undoEvt = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo event → 200', undoEvt.status === 200, `got ${undoEvt.status} ${JSON.stringify(undoEvt.json)}`);

  const afterUndo = await read();
  check('SET HISTORY SURVIVES undo event', (afterUndo.setScores as SetScore[])?.length === 2,
    `setScores=${JSON.stringify(afterUndo.setScores)}`);
  check('SETS WON SURVIVES undo event', afterUndo.homeSetsWon === 2, `got ${afterUndo.homeSetsWon}`);
  check('undo event still reverses its own point', afterUndo.homeScore === 5,
    `expected 5 (6 after the kill, minus 1), got ${afterUndo.homeScore}`);

  // ── Reset Match ──
  console.log('\n── Reset Match (from 2 sets banked) ──');
  const reset = await req('POST', `/matches/${match.id}/score/reset-match`, token);
  check('reset-match → 200', reset.status === 200, `got ${reset.status}`);
  check('sets won zeroed', reset.json?.homeSetsWon === 0 && reset.json?.awaySetsWon === 0);
  check('running score zeroed', reset.json?.homeScore === 0 && reset.json?.awayScore === 0);
  check('set history cleared', (reset.json?.setScores as SetScore[])?.length === 0,
    JSON.stringify(reset.json?.setScores));
  check('status IN_PROGRESS', reset.json?.status === 'IN_PROGRESS');

  // ── Undo Set on an empty history is a no-op ──
  console.log('\n── Undo Set with no sets ──');
  const emptyUndo = await req('POST', `/matches/${match.id}/score/undo-set`, token);
  check('undo-set with empty history → 400', emptyUndo.status === 400, `got ${emptyUndo.status}`);

  // ── Cleanup ──
  await prisma.team.delete({ where: { id: team.id } }); // cascades match/players/events
  await prisma.user.delete({ where: { email: EMAIL } });

  console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.team.deleteMany({ where: { name: 'Smoke SetOps' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: EMAIL } }).catch(() => {});
  process.exit(1);
});
