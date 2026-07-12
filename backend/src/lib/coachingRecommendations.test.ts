import assert from 'node:assert/strict';
import { generateCoachingRecommendations } from '../services/coachingRecommendations.service';
import type { CoachingInput } from '../services/coachingRecommendations.service';
import type { StatLine } from './analytics';
import type { RotationResult } from '../services/rotation.service';
import type { DetailedZoneStats } from './heatmap';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyStats(): StatLine {
  return {
    totalEvents: 0, kills: 0, attackErrors: 0, attackAttempts: 0, hittingPercentage: null,
    tips: 0, freeBalls: 0,
    aces: 0, serviceErrors: 0, serveAttempts: 0, serveInPercentage: null,
    passAttempts: 0, passingRating: null, soloBlocks: 0, blockAssists: 0, totalBlocks: 0,
    blockErrors: 0, digs: 0, digErrors: 0, assists: 0, settingErrors: 0,
  };
}

function emptyRotations(): RotationResult {
  const r = (n: number) => ({ rotation: n, won: 0, lost: 0, total: 0, net: 0, efficiency: null });
  return {
    rotations: [1, 2, 3, 4, 5, 6].map(r),
    insights: { best: null, worst: null, highestSideOut: null, lowestSideOut: null },
  };
}

function emptyZones(): DetailedZoneStats {
  const atk  = () => ({ kills: 0, errors: 0, attempts: 0, hittingPct: null });
  const srv  = () => ({ aces: 0, errors: 0, serveIn: 0, attempts: 0, efficiency: null });
  const pas  = () => ({ pass3: 0, pass2: 0, pass1: 0, pass0: 0, attempts: 0, rating: null });
  const def  = () => ({ digs: 0, soloBlocks: 0, blockAssists: 0, total: 0 });
  const zones: Record<string, any> = {};
  for (const z of ['1', '2', '3', '4', '5', '6']) {
    zones[z] = atk();
  }
  return {
    attack:  Object.fromEntries(['1','2','3','4','5','6'].map(z => [z, atk()])),
    serve:   Object.fromEntries(['1','2','3','4','5','6'].map(z => [z, srv()])),
    pass:    Object.fromEntries(['1','2','3','4','5','6'].map(z => [z, pas()])),
    defence: Object.fromEntries(['1','2','3','4','5','6'].map(z => [z, def()])),
  };
}

function baseInput(): CoachingInput {
  return { stats: emptyStats(), rotations: emptyRotations(), zones: emptyZones() };
}

// ─── No-data case ─────────────────────────────────────────────────────────────

{
  const recs = generateCoachingRecommendations(baseInput());
  assert.equal(recs.length, 0, 'Empty input: no recommendations should fire');
}

console.log('No-data case passed.');

// ─── Attack — HIGH (hitting % below zero) ────────────────────────────────────

{
  const input = baseInput();
  input.stats.attackAttempts = 20;
  input.stats.kills = 3;
  input.stats.attackErrors = 10;
  // hittingPct = (3 - 10) / 20 = -0.350
  input.stats.hittingPercentage = (input.stats.kills - input.stats.attackErrors) / input.stats.attackAttempts;
  const recs = generateCoachingRecommendations(input);
  const attackRec = recs.find((r) => r.category === 'attack');
  assert.ok(attackRec, 'HIGH attack: recommendation should fire');
  assert.equal(attackRec!.priority, 'high', 'HIGH attack: priority should be high');
}

console.log('Attack HIGH case passed.');

// ─── Attack — MEDIUM (hitting % in .000–.149 range) ──────────────────────────

{
  const input = baseInput();
  input.stats.attackAttempts = 20;
  input.stats.kills = 4;
  input.stats.attackErrors = 3;
  // hittingPct = (4 - 3) / 20 = 0.050
  input.stats.hittingPercentage = (input.stats.kills - input.stats.attackErrors) / input.stats.attackAttempts;
  const recs = generateCoachingRecommendations(input);
  const attackRec = recs.find((r) => r.category === 'attack');
  assert.ok(attackRec, 'MEDIUM attack: recommendation should fire');
  assert.equal(attackRec!.priority, 'medium', 'MEDIUM attack: priority should be medium');
}

console.log('Attack MEDIUM case passed.');

// ─── Serve — HIGH (error rate > 20%) ─────────────────────────────────────────

{
  const input = baseInput();
  input.stats.serveAttempts = 20;
  input.stats.serviceErrors = 5; // 25% error rate
  const recs = generateCoachingRecommendations(input);
  const serveRec = recs.find((r) => r.category === 'serve');
  assert.ok(serveRec, 'HIGH serve: recommendation should fire');
  assert.equal(serveRec!.priority, 'high', 'HIGH serve: priority should be high');
}

console.log('Serve HIGH case passed.');

// ─── Serve — MEDIUM (error rate 12–20%) ──────────────────────────────────────

{
  const input = baseInput();
  input.stats.serveAttempts = 20;
  input.stats.serviceErrors = 3; // 15% error rate
  const recs = generateCoachingRecommendations(input);
  const serveRec = recs.find((r) => r.category === 'serve');
  assert.ok(serveRec, 'MEDIUM serve: recommendation should fire');
  assert.equal(serveRec!.priority, 'medium', 'MEDIUM serve: priority should be medium');
}

console.log('Serve MEDIUM case passed.');

// ─── Pass — HIGH (rating < 1.50) ─────────────────────────────────────────────

{
  const input = baseInput();
  input.stats.passAttempts = 20;
  input.stats.passingRating = 1.20;
  const recs = generateCoachingRecommendations(input);
  const passRec = recs.find((r) => r.category === 'pass');
  assert.ok(passRec, 'HIGH pass: recommendation should fire');
  assert.equal(passRec!.priority, 'high', 'HIGH pass: priority should be high');
}

console.log('Pass HIGH case passed.');

// ─── Pass — MEDIUM (rating 1.50–1.99) ────────────────────────────────────────

{
  const input = baseInput();
  input.stats.passAttempts = 20;
  input.stats.passingRating = 1.75;
  const recs = generateCoachingRecommendations(input);
  const passRec = recs.find((r) => r.category === 'pass');
  assert.ok(passRec, 'MEDIUM pass: recommendation should fire');
  assert.equal(passRec!.priority, 'medium', 'MEDIUM pass: priority should be medium');
}

console.log('Pass MEDIUM case passed.');

// ─── Defence — MEDIUM (dig error rate > 20%) ─────────────────────────────────

{
  const input = baseInput();
  input.stats.digs = 15;
  input.stats.digErrors = 5; // 25% error rate
  const recs = generateCoachingRecommendations(input);
  const defRec = recs.find((r) => r.category === 'defence');
  assert.ok(defRec, 'MEDIUM defence: recommendation should fire');
  assert.equal(defRec!.priority, 'medium', 'MEDIUM defence: priority should be medium');
}

console.log('Defence MEDIUM case passed.');

// ─── Rotation — HIGH (net ≤ -5, total ≥ 8) ───────────────────────────────────

{
  const input = baseInput();
  input.rotations.rotations[0] = { rotation: 1, won: 1, lost: 9, total: 10, net: -8, efficiency: 10 };
  const recs = generateCoachingRecommendations(input);
  const rotRec = recs.find((r) => r.category === 'rotation');
  assert.ok(rotRec, 'HIGH rotation: recommendation should fire');
  assert.equal(rotRec!.priority, 'high', 'HIGH rotation: priority should be high');
}

console.log('Rotation HIGH case passed.');

// ─── Rotation — MEDIUM (net ≤ -3, total ≥ 5) ────────────────────────────────

{
  const input = baseInput();
  input.rotations.rotations[0] = { rotation: 1, won: 1, lost: 5, total: 6, net: -4, efficiency: 17 };
  const recs = generateCoachingRecommendations(input);
  const rotRec = recs.find((r) => r.category === 'rotation');
  assert.ok(rotRec, 'MEDIUM rotation: recommendation should fire');
  assert.equal(rotRec!.priority, 'medium', 'MEDIUM rotation: priority should be medium');
}

console.log('Rotation MEDIUM case passed.');

// ─── Healthy stats — no recommendations should fire ───────────────────────────

{
  const input = baseInput();
  // Healthy attack: hittingPct = (12 - 2) / 30 = .333
  input.stats.attackAttempts = 30;
  input.stats.kills = 12;
  input.stats.attackErrors = 2;
  input.stats.hittingPercentage = (12 - 2) / 30;
  // Healthy serve: 3/30 = 10% error rate (below 12% threshold)
  input.stats.serveAttempts = 30;
  input.stats.serviceErrors = 3;
  // Healthy pass: 2.30 rating
  input.stats.passAttempts = 30;
  input.stats.passingRating = 2.30;
  // Healthy defence: 2/20 = 10% dig error rate (below 20%)
  input.stats.digs = 18;
  input.stats.digErrors = 2;
  // Healthy rotations: all near even
  input.rotations.rotations = [
    { rotation: 1, won: 5, lost: 4, total: 9, net: 1, efficiency: 56 },
    { rotation: 2, won: 6, lost: 4, total: 10, net: 2, efficiency: 60 },
    { rotation: 3, won: 5, lost: 5, total: 10, net: 0, efficiency: 50 },
    { rotation: 4, won: 4, lost: 4, total: 8, net: 0, efficiency: 50 },
    { rotation: 5, won: 5, lost: 3, total: 8, net: 2, efficiency: 63 },
    { rotation: 6, won: 4, lost: 5, total: 9, net: -1, efficiency: 44 },
  ];
  const recs = generateCoachingRecommendations(input);
  assert.equal(recs.length, 0, 'Healthy stats: no recommendations should fire');
}

console.log('Healthy-stats case passed.');

// ─── Sort order — high before medium ─────────────────────────────────────────

{
  const input = baseInput();
  // Trigger MEDIUM serve
  input.stats.serveAttempts = 20;
  input.stats.serviceErrors = 3;
  // Trigger HIGH pass
  input.stats.passAttempts = 20;
  input.stats.passingRating = 1.10;
  const recs = generateCoachingRecommendations(input);
  assert.equal(recs[0].priority, 'high', 'Sort order: first recommendation should be high priority');
  assert.equal(recs[1].priority, 'medium', 'Sort order: second recommendation should be medium priority');
}

console.log('Sort order case passed.');

console.log('All coaching recommendations tests passed.');
