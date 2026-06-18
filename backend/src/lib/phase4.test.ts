import assert from 'node:assert/strict';
import { scoringTeam, HOME_POINT_SET, AWAY_POINT_SET } from './scoringRules';
import { validateMatchScore, clampScore } from './scoreValidation';
import { calculateMomentum } from '../services/momentum.service';
import { calculateRotations } from '../services/rotation.service';

// ── Scoring Rules ────────────────────────────────────────────────────────────

assert.equal(scoringTeam('KILL'), 'home');
assert.equal(scoringTeam('ACE'), 'home');
assert.equal(scoringTeam('SOLO_BLOCK'), 'home');
assert.equal(scoringTeam('BLOCK_ASSIST'), 'home');
assert.equal(scoringTeam('ATTACK_ERROR'), 'away');
assert.equal(scoringTeam('SERVICE_ERROR'), 'away');
assert.equal(scoringTeam('DIG'), null);
assert.equal(scoringTeam('PASS_3'), null);
assert.equal(scoringTeam('ASSIST'), null);
assert.ok(HOME_POINT_SET.has('KILL'));
assert.ok(AWAY_POINT_SET.has('SERVICE_ERROR'));
assert.ok(!HOME_POINT_SET.has('DIG'));

console.log('Scoring rules tests passed.');

// ── Score Validation ─────────────────────────────────────────────────────────

const validState = { homeScore: 10, awayScore: 8, homeSetsWon: 1, awaySetsWon: 1 };
assert.ok(validateMatchScore(validState).valid);

const negativeScore = { homeScore: -1, awayScore: 0, homeSetsWon: 0, awaySetsWon: 0 };
assert.ok(!validateMatchScore(negativeScore).valid);
assert.ok(validateMatchScore(negativeScore).errors.some((e) => e.includes('negative')));

const tooManySets = { homeScore: 0, awayScore: 0, homeSetsWon: 4, awaySetsWon: 0 };
assert.ok(!validateMatchScore(tooManySets).valid);

const bothWon = { homeScore: 0, awayScore: 0, homeSetsWon: 3, awaySetsWon: 3 };
assert.ok(!validateMatchScore(bothWon).valid);

const tooManyTotalSets = { homeScore: 0, awayScore: 0, homeSetsWon: 3, awaySetsWon: 3 };
assert.ok(!validateMatchScore(tooManyTotalSets).valid);

assert.equal(clampScore(5), 5);
assert.equal(clampScore(0), 0);
assert.equal(clampScore(-3), 0);

console.log('Score validation tests passed.');

// ── Set Completion Logic (pure simulation) ────────────────────────────────────

function hasWonSet(score: number, opponentScore: number, setNumber: number): boolean {
  const target = setNumber >= 5 ? 15 : 25;
  return score >= target && score - opponentScore >= 2;
}

// Standard set: 25-0
assert.ok(hasWonSet(25, 0, 1));
// Win by 2 required: 25-23 = ok, 25-24 = not ok (only 1 point lead), 26-24 = ok
assert.ok(hasWonSet(25, 23, 1));
assert.ok(!hasWonSet(25, 24, 1));
assert.ok(!hasWonSet(25, 25, 1));
// Deuce: 26-24 = ok
assert.ok(hasWonSet(26, 24, 1));
// Not yet at 25: 24-20 = no
assert.ok(!hasWonSet(24, 20, 1));
// Set 5 rules: first to 15 win by 2
assert.ok(hasWonSet(15, 0, 5));
assert.ok(hasWonSet(15, 13, 5));
assert.ok(!hasWonSet(15, 14, 5));
assert.ok(hasWonSet(16, 14, 5));
// Set 5 doesn't apply target of 25
assert.ok(!hasWonSet(14, 0, 5));

console.log('Set completion logic tests passed.');

// ── Match Completion (3-set and 5-set) ────────────────────────────────────────

function isMatchComplete(homeSets: number, awaySets: number): boolean {
  return homeSets >= 3 || awaySets >= 3;
}

assert.ok(isMatchComplete(3, 0));
assert.ok(isMatchComplete(3, 2));
assert.ok(isMatchComplete(0, 3));
assert.ok(isMatchComplete(2, 3));
assert.ok(!isMatchComplete(2, 2));
assert.ok(!isMatchComplete(1, 2));

console.log('Match completion tests passed.');

// ── Undo Score Reversal (pure logic simulation) ───────────────────────────────

function simulateUndo(
  homeScore: number,
  awayScore: number,
  eventType: string,
): { homeScore: number; awayScore: number } {
  const team = scoringTeam(eventType);
  if (team === 'home') return { homeScore: Math.max(0, homeScore - 1), awayScore };
  if (team === 'away') return { homeScore, awayScore: Math.max(0, awayScore - 1) };
  return { homeScore, awayScore };
}

// KILL undo reduces home score
let state = simulateUndo(13, 10, 'KILL');
assert.equal(state.homeScore, 12);
assert.equal(state.awayScore, 10);

// SERVICE_ERROR undo reduces away score
state = simulateUndo(13, 10, 'SERVICE_ERROR');
assert.equal(state.homeScore, 13);
assert.equal(state.awayScore, 9);

// Non-scoring event (DIG) undo does nothing
state = simulateUndo(13, 10, 'DIG');
assert.equal(state.homeScore, 13);
assert.equal(state.awayScore, 10);

// Score cannot go below 0
state = simulateUndo(0, 0, 'KILL');
assert.equal(state.homeScore, 0);

state = simulateUndo(5, 0, 'SERVICE_ERROR');
assert.equal(state.awayScore, 0);

console.log('Undo score reversal tests passed.');

// ── Momentum Analytics ────────────────────────────────────────────────────────

const now = new Date();
const mkEvent = (type: string, set = 1) => ({ eventType: type, setNumber: set, recordedAt: now });

// Empty
const emptyMomentum = calculateMomentum([]);
assert.equal(emptyMomentum.stats.totalPoints, 0);
assert.equal(emptyMomentum.timeline.length, 0);
assert.equal(emptyMomentum.significantRuns.length, 0);

// 5 consecutive home points — run of 5
const homeRun = Array(5).fill(mkEvent('KILL'));
const hmRun = calculateMomentum(homeRun);
assert.equal(hmRun.stats.longestHomeRun, 5);
assert.equal(hmRun.stats.longestAwayRun, 0);
assert.equal(hmRun.stats.totalPoints, 5);
assert.equal(hmRun.timeline[4].homeScore, 5);
assert.equal(hmRun.timeline[4].awayScore, 0);
assert.equal(hmRun.timeline[4].lead, 5);

// Alternating = many lead changes
const alternating = Array(6).fill(null).flatMap((_, i) =>
  i % 2 === 0 ? [mkEvent('KILL')] : [mkEvent('ATTACK_ERROR')],
);
const altResult = calculateMomentum(alternating);
assert.ok(altResult.stats.leadChanges >= 1);

// Significant run threshold = 3
const run3 = [...Array(3).fill(mkEvent('ACE')), mkEvent('ATTACK_ERROR')];
const sigRun = calculateMomentum(run3);
assert.ok(sigRun.significantRuns.length >= 1);
assert.ok(sigRun.significantRuns[0].length >= 3);

// Only scoring events in timeline (non-scoring filtered)
const mixed = [mkEvent('DIG'), mkEvent('KILL'), mkEvent('PASS_3')];
const mixedResult = calculateMomentum(mixed);
assert.equal(mixedResult.stats.totalPoints, 1);
assert.equal(mixedResult.timeline.length, 1);

console.log('Momentum analytics tests passed.');

// ── Rotation Analytics ────────────────────────────────────────────────────────

// Empty
const emptyRot = calculateRotations([]);
assert.equal(emptyRot.rotations.length, 6);
assert.equal(emptyRot.insights.best, null);

// All home points in rotation 3
const rot3Events = Array(8).fill({ eventType: 'KILL', rotationNumber: 3 });
const rot3Result = calculateRotations(rot3Events);
const r3 = rot3Result.rotations.find((r) => r.rotation === 3)!;
assert.equal(r3.won, 8);
assert.equal(r3.lost, 0);
assert.equal(r3.net, 8);
assert.equal(r3.efficiency, 100);

// Best and worst rotation
const mixedRotEvents = [
  ...Array(5).fill({ eventType: 'KILL', rotationNumber: 1 }),
  ...Array(2).fill({ eventType: 'ATTACK_ERROR', rotationNumber: 1 }),
  ...Array(1).fill({ eventType: 'KILL', rotationNumber: 2 }),
  ...Array(4).fill({ eventType: 'ATTACK_ERROR', rotationNumber: 2 }),
];
const mixedRot = calculateRotations(mixedRotEvents);
assert.equal(mixedRot.insights.best!.rotation, 1);
assert.equal(mixedRot.insights.worst!.rotation, 2);

// Null rotation numbers must be ignored
const nullRot = [
  { eventType: 'KILL', rotationNumber: null },
  { eventType: 'KILL', rotationNumber: 4 },
];
const nullRotResult = calculateRotations(nullRot);
const r4 = nullRotResult.rotations.find((r) => r.rotation === 4)!;
assert.equal(r4.won, 1);
const nullEntry = nullRotResult.rotations.find((r) => r.rotation === 0);
assert.equal(nullEntry, undefined);

// Out-of-range rotations must be ignored
const outOfRange = [{ eventType: 'KILL', rotationNumber: 7 }];
const oorResult = calculateRotations(outOfRange);
assert.ok(oorResult.rotations.every((r) => r.total === 0));

// Efficiency calculation: 3 won, 1 lost = 75%
const effEvents = [
  ...Array(3).fill({ eventType: 'KILL', rotationNumber: 5 }),
  { eventType: 'ATTACK_ERROR', rotationNumber: 5 },
];
const effResult = calculateRotations(effEvents);
const r5 = effResult.rotations.find((r) => r.rotation === 5)!;
assert.equal(r5.efficiency, 75);

console.log('Rotation analytics tests passed.');
