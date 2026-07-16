/**
 * End-to-end smoke test for the live scoreboard's score mutations.
 *
 * Manual End Set / Undo Set were withdrawn after hands-on testing (End Set is
 * commented out in controllers/matches.ts for possible future use; Undo Set is
 * gone). What's left to protect is:
 *   - automatic set completion at 25 / 15 win-by-2 still fires,
 *   - Undo Event undoes the last stat event and nothing more,
 *   - Undo Event reverses a manual score tap when THAT is the last action,
 *     in the right direction, instead of reaching past it to an older event,
 *   - Reset Match still clears sets won and the whole history but keeps the
 *     recorded stat events, and writes an audit row saying what it wiped,
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

  // ── Bug 1: Undo must reverse a score tap, not the stat event behind it ──
  // A score tap writes a ScoreAdjustment, not an Event. Undo used to look only
  // at Events, so it skipped the tap and silently reversed the older kill.
  console.log('\n── Undo after a score tap (stat event → − tap → undo) ──');
  await setScore(10, 10);
  await kill(1);                                   // stat event: home 11-10
  const beforeTap = await read();
  check('kill recorded → 11-10', beforeTap.homeScore === 11, `got ${beforeTap.homeScore}`);
  const eventsBeforeTap = await eventCount();

  // The − button: an absolute update that stores a -1 delta.
  await setScore(beforeTap.homeScore - 1, beforeTap.awayScore); // tap −: 10-10
  const tapped = await read();
  check('− tap → 10-10', tapped.homeScore === 10, `got ${tapped.homeScore}`);

  const undoTap = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo → 200', undoTap.status === 200, `got ${undoTap.status}`);
  check('undo targeted the ADJUSTMENT, not the event', undoTap.json?.kind === 'adjustment',
    `got kind=${undoTap.json?.kind}`);
  const afterUndoTap = await read();
  check('undo reverses the − UP to 11, not down to 9',
    afterUndoTap.homeScore === 11, `expected 11, got ${afterUndoTap.homeScore}`);
  check('the stat event behind the tap is untouched',
    (await eventCount()) === eventsBeforeTap, `expected ${eventsBeforeTap} events`);

  // ── Bug 1 regression guard: undo with no adjustments still undoes the event ──
  console.log('\n── Undo with no adjustments in between (original behaviour) ──');
  const beforeEventUndo = await read();
  const eventsBeforeUndo = await eventCount();
  const undoEvt2 = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo → 200', undoEvt2.status === 200, `got ${undoEvt2.status}`);
  check('undo targeted the EVENT', undoEvt2.json?.kind === 'event', `got kind=${undoEvt2.json?.kind}`);
  check('event removed', (await eventCount()) === eventsBeforeUndo - 1);
  check('its point came back off',
    (await read()).homeScore === beforeEventUndo.homeScore - 1,
    `expected ${beforeEventUndo.homeScore - 1}`);

  // ── Bug 2: Reset Match keeps stat events and audits what it wiped ──
  console.log('\n── Reset Match keeps recorded stats + writes an audit row ──');
  await kill(1);
  await req('POST', '/events', token, { matchId: match.id, playerId: player.id, eventType: 'DIG', setNumber: 1 });
  const eventsBeforeReset = await eventCount();
  check('events exist before the reset', eventsBeforeReset >= 2, `got ${eventsBeforeReset}`);

  const auditBefore = await prisma.auditLog.count({ where: { action: 'RESET_MATCH', resourceId: match.id } });
  const reset2 = await req('POST', `/matches/${match.id}/score/reset-match`, token);
  check('reset-match → 200', reset2.status === 200, `got ${reset2.status}`);

  check('recorded stat events SURVIVE the reset', (await eventCount()) === eventsBeforeReset,
    `expected ${eventsBeforeReset}, got ${await eventCount()}`);
  check('events are still visible in the match event log',
    (await req('GET', `/events/by-match/${match.id}`, token)).json.length === eventsBeforeReset);

  const auditRow = await prisma.auditLog.findFirst({
    where: { action: 'RESET_MATCH', resourceId: match.id },
    orderBy: { createdAt: 'desc' },
  });
  check('an audit row was written for the reset',
    (await prisma.auditLog.count({ where: { action: 'RESET_MATCH', resourceId: match.id } })) === auditBefore + 1);
  check('audit row records the acting user', auditRow?.userId === owner.id);
  check('audit row is scoped to the match resource',
    auditRow?.resource === 'match' && auditRow?.resourceId === match.id);
  const meta = (auditRow?.meta ?? {}) as Record<string, unknown>;
  check('audit meta records how many events were kept', meta.eventsKept === eventsBeforeReset,
    `got ${JSON.stringify(meta)}`);
  check('audit meta records the cleared score', 'clearedHomeScore' in meta && 'clearedAwayScore' in meta);
  check('audit meta records the cleared sets/history',
    'clearedHomeSetsWon' in meta && 'clearedAwaySetsWon' in meta && 'clearedSetScores' in meta);
  check('audit meta records adjustments deleted', typeof meta.scoreAdjustmentsDeleted === 'number');

  // ── Undoing the point that CLOSED a set ──
  // checkSetCompletion runs in the same request as the closing point and zeroes
  // the running score, so reversing against the current score used to give
  // 0 - 1 → 0 and leave the set banked: the set-winning tap silently no-opped.
  console.log('\n── Undo the tap that completed a set ──');
  await req('POST', `/matches/${match.id}/score/reset-match`, token);
  await setScore(24, 20);
  const preClose = await read();
  check('set up at 24-20, nothing banked',
    preClose.homeScore === 24 && (preClose.setScores as SetScore[]).length === 0);

  await setScore(25, 20); // the closing tap
  const closed = await read();
  check('25-20 completes the set', closed.homeSetsWon === 1, `got ${closed.homeSetsWon}`);
  check('completion zeroed the running score', closed.homeScore === 0 && closed.awayScore === 0);
  check('the set is banked', (closed.setScores as SetScore[]).length === 1);

  const undoClose = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo → 200', undoClose.status === 200, `got ${undoClose.status}`);
  check('undo reports it un-completed a set', undoClose.json?.uncompletedSet === true,
    JSON.stringify(undoClose.json));
  const reopened = await read();
  check('score restored to 24-20 (NOT clamped to 0)',
    reopened.homeScore === 24 && reopened.awayScore === 20,
    `expected 24-20, got ${reopened.homeScore}-${reopened.awayScore}`);
  check('the set is un-banked', (reopened.setScores as SetScore[]).length === 0,
    JSON.stringify(reopened.setScores));
  check('the set is handed back', reopened.homeSetsWon === 0, `got ${reopened.homeSetsWon}`);

  // ── …and when that set also won the MATCH ──
  console.log('\n── Undo the tap that won the match ──');
  await prisma.match.update({
    where: { id: match.id },
    data: {
      homeSetsWon: 2, awaySetsWon: 0, homeScore: 0, awayScore: 0, status: 'IN_PROGRESS',
      setScores: [{ set: 1, home: 25, away: 20 }, { set: 2, home: 25, away: 21 }],
    },
  });
  await setScore(24, 22);
  await setScore(25, 22); // match point
  const won = await read();
  check('third set completes the match', won.status === 'COMPLETED', `got ${won.status}`);
  check('sets won 3-0', won.homeSetsWon === 3);

  const undoWin = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo → 200', undoWin.status === 200, `got ${undoWin.status}`);
  const afterUndoWin = await read();
  check('match reopened to IN_PROGRESS', afterUndoWin.status === 'IN_PROGRESS', `got ${afterUndoWin.status}`);
  check('sets won back to 2-0', afterUndoWin.homeSetsWon === 2, `got ${afterUndoWin.homeSetsWon}`);
  check('play resumes at match point 24-22',
    afterUndoWin.homeScore === 24 && afterUndoWin.awayScore === 22,
    `got ${afterUndoWin.homeScore}-${afterUndoWin.awayScore}`);
  check('earlier sets survive', (afterUndoWin.setScores as SetScore[]).length === 2);

  // ── A tap that does NOT complete a set is unaffected ──
  console.log('\n── Undo a non-completing tap (unchanged behaviour) ──');
  await setScore(10, 8);
  const plainBefore = await read();
  await setScore(9, 8); // a plain − tap
  const undoPlain = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo → 200', undoPlain.status === 200);
  check('does not report un-completing a set', undoPlain.json?.uncompletedSet === undefined);
  const plainAfter = await read();
  check('plain − reverses UP to 10 as before', plainAfter.homeScore === 10, `got ${plainAfter.homeScore}`);
  check('set state untouched', plainAfter.homeSetsWon === plainBefore.homeSetsWon);

  // ── Event side: same bug, same fix, on an overridden match ──
  // manualScoreOverride is true here (Reset Match set it), so event undo can't
  // replay the timeline and reverses the event directly — the same trap.
  console.log('\n── Undo the EVENT that completed a set (overridden match) ──');
  const overridden = await prisma.match.findUnique({
    where: { id: match.id }, select: { manualScoreOverride: true },
  });
  check('match is under manualScoreOverride (so undo cannot replay)',
    overridden?.manualScoreOverride === true);

  await prisma.match.update({
    where: { id: match.id },
    data: { homeSetsWon: 0, awaySetsWon: 0, homeScore: 0, awayScore: 0, status: 'IN_PROGRESS', setScores: [] },
  });
  await prisma.scoreAdjustment.deleteMany({ where: { matchId: match.id } });
  await setScore(24, 20);
  await prisma.scoreAdjustment.deleteMany({ where: { matchId: match.id } }); // leave the event as the last action
  await kill(1); // the closing KILL: 25-20
  const eventClosed = await read();
  check('the kill completes the set', eventClosed.homeSetsWon === 1, `got ${eventClosed.homeSetsWon}`);
  check('completion zeroed the running score', eventClosed.homeScore === 0);

  const undoEventClose = await req('DELETE', `/events/undo/${match.id}`, token);
  check('undo → 200', undoEventClose.status === 200, `got ${undoEventClose.status}`);
  check('undo targeted the event', undoEventClose.json?.kind === 'event', `got ${undoEventClose.json?.kind}`);
  const eventReopened = await read();
  check('score restored to 24-20 (NOT clamped to 0)',
    eventReopened.homeScore === 24 && eventReopened.awayScore === 20,
    `expected 24-20, got ${eventReopened.homeScore}-${eventReopened.awayScore}`);
  check('the set is un-banked', (eventReopened.setScores as SetScore[]).length === 0);
  check('the set is handed back', eventReopened.homeSetsWon === 0, `got ${eventReopened.homeSetsWon}`);

  // ── Cleanup ──
  await prisma.auditLog.deleteMany({ where: { resourceId: match.id } });
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
