import assert from 'node:assert/strict';
import { generatePlayerDevelopmentReport } from '../services/playerDevelopment.service';
import type { MatchStatEntry } from '../services/playerDevelopment.service';
import type { StatLine } from './analytics';

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

function makeEntry(daysAgo: number, overrides: Partial<StatLine> = {}): MatchStatEntry {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { matchDate: d, stats: { ...emptyStats(), ...overrides } };
}

// Build a list of N entries spaced 7 days apart (oldest first).
function makeEntries(count: number, statsPerMatch: Partial<StatLine>[] | Partial<StatLine>): MatchStatEntry[] {
  const arr = Array.isArray(statsPerMatch) ? statsPerMatch : Array(count).fill(statsPerMatch);
  return arr.map((s, i) => makeEntry((count - i) * 7, s));
}

// ─── Threshold confirmation ───────────────────────────────────────────────────
// Explicitly verify the threshold values match coachingRecommendations.service.ts.
// If those values change, this suite will catch a mismatch.

{
  // Attack strength ≥ .250
  const strong = makeEntries(6, [
    // prior 3: decent but not strong (.200)
    { attackAttempts: 10, kills: 4, attackErrors: 2 },
    { attackAttempts: 10, kills: 4, attackErrors: 2 },
    { attackAttempts: 10, kills: 4, attackErrors: 2 },
    // recent 3: ≥ .250 hitting
    { attackAttempts: 10, kills: 5, attackErrors: 2 },  // .300
    { attackAttempts: 10, kills: 5, attackErrors: 2 },
    { attackAttempts: 10, kills: 5, attackErrors: 2 },
  ]);
  const report = generatePlayerDevelopmentReport(strong);
  assert.ok(report.strengths.includes('Attack'), 'Attack threshold .250: should be a strength at .300');
}

{
  // Attack weakness < .150
  const weak = makeEntries(6, { attackAttempts: 10, kills: 1, attackErrors: 0 }); // .100
  const report = generatePlayerDevelopmentReport(weak);
  assert.ok(report.weaknesses.includes('Attack'), 'Attack threshold .150: should be a weakness at .100');
}

{
  // Serve error rate strength ≤ 0.08 (8%)
  const strong = makeEntries(6, { serveAttempts: 25, serviceErrors: 2 }); // 8%
  const report = generatePlayerDevelopmentReport(strong);
  assert.ok(report.strengths.includes('Serve'), 'Serve threshold 0.08: should be a strength at 8%');
}

{
  // Serve error rate weakness > 0.12 (12%)
  const weak = makeEntries(6, { serveAttempts: 20, serviceErrors: 3 }); // 15%
  const report = generatePlayerDevelopmentReport(weak);
  assert.ok(report.weaknesses.includes('Serve'), 'Serve threshold 0.12: should be a weakness at 15%');
}

{
  // Pass rating strength ≥ 2.00
  const strong = makeEntries(6, { passAttempts: 10, passingRating: 2.20 });
  const report = generatePlayerDevelopmentReport(strong);
  assert.ok(report.strengths.includes('Pass'), 'Pass threshold 2.00: should be a strength at 2.20');
}

{
  // Pass rating weakness < 1.50
  const weak = makeEntries(6, { passAttempts: 10, passingRating: 1.30 });
  const report = generatePlayerDevelopmentReport(weak);
  assert.ok(report.weaknesses.includes('Pass'), 'Pass threshold 1.50: should be a weakness at 1.30');
}

{
  // Defence strength ≤ 0.10 (10%)
  const strong = makeEntries(6, { digs: 9, digErrors: 1 }); // 10%
  const report = generatePlayerDevelopmentReport(strong);
  assert.ok(report.strengths.includes('Defence'), 'Defence threshold 0.10: should be a strength at 10%');
}

{
  // Defence weakness > 0.20 (20%)
  const weak = makeEntries(6, { digs: 14, digErrors: 6 }); // 30%
  const report = generatePlayerDevelopmentReport(weak);
  assert.ok(report.weaknesses.includes('Defence'), 'Defence threshold 0.20: should be a weakness at 30%');
}

console.log('Threshold confirmation tests passed.');

// ─── Insufficient data (< 6 matches) ─────────────────────────────────────────

{
  const report = generatePlayerDevelopmentReport([]);
  assert.equal(report.trend, 'insufficient_data', 'Empty: trend should be insufficient_data');
  assert.equal(report.strengths.length, 0, 'Empty: no strengths');
  assert.equal(report.weaknesses.length, 0, 'Empty: no weaknesses');
  assert.equal(report.mostImproved, null, 'Empty: mostImproved null');
  assert.equal(report.needsAttention, null, 'Empty: needsAttention null');
}

{
  const report = generatePlayerDevelopmentReport(makeEntries(5, emptyStats()));
  assert.equal(report.trend, 'insufficient_data', '5 matches: still insufficient_data');
}

console.log('Insufficient-data cases passed.');

// ─── Clear improvement case ───────────────────────────────────────────────────
// Prior 3 matches: poor attack (.050). Recent 3: strong attack (.350).

{
  const entries = makeEntries(6, [
    { attackAttempts: 20, kills: 2, attackErrors: 1 },  // prior .050
    { attackAttempts: 20, kills: 2, attackErrors: 1 },
    { attackAttempts: 20, kills: 2, attackErrors: 1 },
    { attackAttempts: 20, kills: 9, attackErrors: 2 },  // recent .350
    { attackAttempts: 20, kills: 9, attackErrors: 2 },
    { attackAttempts: 20, kills: 9, attackErrors: 2 },
  ]);
  const report = generatePlayerDevelopmentReport(entries);
  assert.equal(report.trend, 'improving', 'Clear improvement: trend should be improving');
  assert.ok(report.mostImproved !== null, 'Clear improvement: mostImproved should be set');
  assert.equal(report.mostImproved!.category, 'Attack', 'Clear improvement: mostImproved category should be Attack');
  assert.ok(report.strengths.includes('Attack'), 'Clear improvement: Attack should be a strength');
}

console.log('Clear-improvement case passed.');

// ─── Clear decline case ───────────────────────────────────────────────────────
// Prior 3: good passing (2.20). Recent 3: poor passing (1.20).

{
  const entries = makeEntries(6, [
    { passAttempts: 15, passingRating: 2.20 },
    { passAttempts: 15, passingRating: 2.20 },
    { passAttempts: 15, passingRating: 2.20 },
    { passAttempts: 15, passingRating: 1.20 },
    { passAttempts: 15, passingRating: 1.20 },
    { passAttempts: 15, passingRating: 1.20 },
  ]);
  const report = generatePlayerDevelopmentReport(entries);
  assert.equal(report.trend, 'declining', 'Clear decline: trend should be declining');
  assert.ok(report.needsAttention !== null, 'Clear decline: needsAttention should be set');
  assert.equal(report.needsAttention!.category, 'Pass', 'Clear decline: needsAttention category should be Pass');
  assert.ok(report.weaknesses.includes('Pass'), 'Clear decline: Pass should be a weakness');
}

console.log('Clear-decline case passed.');

// ─── Mixed case ───────────────────────────────────────────────────────────────
// Attack improves; serve worsens. More improved than declined → 'improving' overall.

{
  const entries = makeEntries(6, [
    // prior: weak attack (.050), ok serve (8% errors)
    { attackAttempts: 20, kills: 2, attackErrors: 1, serveAttempts: 25, serviceErrors: 2 },
    { attackAttempts: 20, kills: 2, attackErrors: 1, serveAttempts: 25, serviceErrors: 2 },
    { attackAttempts: 20, kills: 2, attackErrors: 1, serveAttempts: 25, serviceErrors: 2 },
    // recent: strong attack (.350), bad serve (20% errors)
    { attackAttempts: 20, kills: 9, attackErrors: 2, serveAttempts: 25, serviceErrors: 5 },
    { attackAttempts: 20, kills: 9, attackErrors: 2, serveAttempts: 25, serviceErrors: 5 },
    { attackAttempts: 20, kills: 9, attackErrors: 2, serveAttempts: 25, serviceErrors: 5 },
  ]);
  const report = generatePlayerDevelopmentReport(entries);
  // 1 improved (attack), 1 declined (serve) → equal → stable
  assert.equal(report.trend, 'stable', 'Mixed (1 improved, 1 declined): trend should be stable');
  assert.ok(report.mostImproved !== null, 'Mixed: mostImproved should be set');
  assert.ok(report.needsAttention !== null, 'Mixed: needsAttention should be set');
  assert.equal(report.mostImproved!.category, 'Attack', 'Mixed: mostImproved should be Attack');
  assert.equal(report.needsAttention!.category, 'Serve', 'Mixed: needsAttention should be Serve');
}

console.log('Mixed case passed.');

// ─── Stable case (no category changed enough to qualify) ──────────────────────
// All windows have null metrics (no activity) → no deltas → stable.

{
  const entries = makeEntries(6, emptyStats());
  const report = generatePlayerDevelopmentReport(entries);
  assert.equal(report.trend, 'stable', 'No-activity: trend should be stable (no deltas)');
  assert.equal(report.mostImproved, null, 'No-activity: mostImproved null');
  assert.equal(report.needsAttention, null, 'No-activity: needsAttention null');
}

console.log('Stable (no-activity) case passed.');

// ─── Sort: chronological input order should not affect output ─────────────────

{
  const entries = [
    makeEntry(1,  { attackAttempts: 20, kills: 9, attackErrors: 2 }),  // recent
    makeEntry(14, { attackAttempts: 20, kills: 2, attackErrors: 1 }),  // prior
    makeEntry(7,  { attackAttempts: 20, kills: 9, attackErrors: 2 }),  // recent
    makeEntry(35, { attackAttempts: 20, kills: 2, attackErrors: 1 }),  // prior
    makeEntry(21, { attackAttempts: 20, kills: 2, attackErrors: 1 }),  // prior
    makeEntry(28, { attackAttempts: 20, kills: 9, attackErrors: 2 }),  // recent ← note: oldest-looking but actually 4 weeks ago
  ];
  // After sort by date: [35,28,21,14,7,1] days ago → prior=[35,28,21], recent=[14,7,1]
  // prior avg: (.050+.350+.050)/3 = .150, recent: (.350+.350+.350)/3 = .350 → improving
  const report = generatePlayerDevelopmentReport(entries);
  assert.equal(report.trend, 'improving', 'Out-of-order input: trend should still be improving after sort');
}

console.log('Sort-order case passed.');

console.log('All player development tests passed.');
