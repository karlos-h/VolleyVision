import assert from 'node:assert/strict';
import { generateSeasonIntelligence } from '../services/seasonIntelligence.service';
import type { TeamTrend } from '../services/seasonIntelligence.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTrend(overrides: Partial<Omit<TeamTrend, 'matchDate'>> & { daysAgo: number }): TeamTrend {
  const d = new Date();
  d.setDate(d.getDate() - overrides.daysAgo);
  return {
    matchId:          overrides.matchId          ?? 'id',
    opponent:         overrides.opponent         ?? 'Opponent',
    matchDate:        d,
    kills:            overrides.kills            ?? 10,
    aces:             overrides.aces             ?? 2,
    blocks:           overrides.blocks           ?? 3,
    digs:             overrides.digs             ?? 15,
    hittingPercentage:overrides.hittingPercentage ?? 0.200,
  };
}

// Build N trends spaced 7 days apart, oldest first, with per-match overrides.
function makeTrends(
  perMatch: Array<Partial<Omit<TeamTrend, 'matchDate'>>>,
): TeamTrend[] {
  return perMatch.map((o, i) => makeTrend({ ...o, daysAgo: (perMatch.length - i) * 7 }));
}

// ─── Insufficient data (< 5 matches) ─────────────────────────────────────────

{
  const report = generateSeasonIntelligence([]);
  assert.equal(report.trajectory, 'insufficient_data', 'Empty: trajectory should be insufficient_data');
  assert.equal(report.insights.length, 0, 'Empty: no insights');
  assert.equal(report.seasonAverages.kills, 0, 'Empty: averages default to 0');
}

{
  const report = generateSeasonIntelligence(makeTrends([
    { kills: 8 }, { kills: 10 }, { kills: 12 }, { kills: 9 },
  ]));
  assert.equal(report.trajectory, 'insufficient_data', '4 matches: still insufficient_data');
  // Averages ARE computed even below the threshold
  assert.ok(report.seasonAverages.kills > 0, '4 matches: averages still computed');
}

console.log('Insufficient-data cases passed.');

// ─── Improving streak (kills rising for 5 consecutive matches) ────────────────

{
  const report = generateSeasonIntelligence(makeTrends([
    { kills: 5  },
    { kills: 7  },
    { kills: 9  },
    { kills: 11 },
    { kills: 13 },
    { kills: 15 },
  ]));
  assert.notEqual(report.trajectory, 'insufficient_data', '6 matches: should have trajectory');
  const killsInsight = report.insights.find((i) => i.category === 'kills');
  assert.ok(killsInsight, 'Rising kills streak: insight should be present');
  assert.equal(killsInsight!.direction, 'positive', 'Rising kills: direction should be positive');
  assert.ok(killsInsight!.message.includes('6'), 'Rising kills: message should cite streak length of 6');
  assert.equal(report.trajectory, 'improving', 'All metrics steady except kills rising → improving');
}

console.log('Improving-streak case passed.');

// ─── Declining streak (aces dropping for 4 consecutive matches) ──────────────

{
  const report = generateSeasonIntelligence(makeTrends([
    { aces: 10 },
    { aces: 8  },
    { aces: 7  },
    { aces: 5  },
    { aces: 3  },
    { aces: 1  },
  ]));
  const acesInsight = report.insights.find((i) => i.category === 'aces');
  assert.ok(acesInsight, 'Declining aces streak: insight should be present');
  assert.equal(acesInsight!.direction, 'negative', 'Declining aces: direction should be negative');
  assert.ok(acesInsight!.message.includes('6'), 'Declining aces: message should cite streak length of 6');
  assert.equal(report.trajectory, 'declining', 'All metrics steady except aces declining → declining');
}

console.log('Declining-streak case passed.');

// ─── Mixed trajectory (some categories up, some down) ────────────────────────

{
  // Prior 3 (oldest): high kills, low aces
  // Recent 3: low kills, high aces
  // Net result: 1 improved (aces), 1 declined (kills), 3 unchanged → mixed
  const report = generateSeasonIntelligence(makeTrends([
    { kills: 20, aces: 1, blocks: 5, digs: 15, hittingPercentage: 0.200 },
    { kills: 20, aces: 1, blocks: 5, digs: 15, hittingPercentage: 0.200 },
    { kills: 20, aces: 1, blocks: 5, digs: 15, hittingPercentage: 0.200 },
    { kills: 5,  aces: 8, blocks: 5, digs: 15, hittingPercentage: 0.200 },
    { kills: 5,  aces: 8, blocks: 5, digs: 15, hittingPercentage: 0.200 },
    { kills: 5,  aces: 8, blocks: 5, digs: 15, hittingPercentage: 0.200 },
  ]));
  assert.equal(report.trajectory, 'mixed', 'Mixed (kills down, aces up, rest flat): trajectory should be mixed');
}

console.log('Mixed-trajectory case passed.');

// ─── Only the longest streak per category is reported ─────────────────────────
// Pattern: short early streak of 2 values [3,5] (not reported, < 3 threshold),
// break at 4, then a longer streak of 5 values [4,6,8,10,12].
// Only one insight for kills should appear, citing a streak of 5.

{
  const report = generateSeasonIntelligence(makeTrends([
    { kills: 3  },  // start of short rise (length 2 — below threshold)
    { kills: 5  },
    { kills: 4  },  // break
    { kills: 6  },  // longer rise starts: [4,6,8,10,12] = 5 consecutive matches
    { kills: 8  },
    { kills: 10 },
    { kills: 12 },
  ]));
  const killsInsights = report.insights.filter((i) => i.category === 'kills');
  assert.equal(killsInsights.length, 1, 'Only one insight per category (the longest streak)');
  assert.ok(killsInsights[0].message.includes('5'), 'Longest kills streak is 5 consecutive matches');
}

console.log('Longest-streak-only case passed.');

// ─── Season averages are always returned ─────────────────────────────────────

{
  const report = generateSeasonIntelligence(makeTrends([
    { kills: 10, aces: 4, blocks: 2, digs: 20, hittingPercentage: 0.300 },
    { kills: 20, aces: 6, blocks: 4, digs: 10, hittingPercentage: 0.100 },
  ]));
  // Only 2 matches — insufficient_data — but averages must still be computed
  assert.equal(report.trajectory, 'insufficient_data');
  assert.equal(report.seasonAverages.kills, 15, 'Averages: kills mean = 15');
  assert.equal(report.seasonAverages.aces,   5, 'Averages: aces mean = 5');
  assert.equal(report.seasonAverages.blocks,  3, 'Averages: blocks mean = 3');
  assert.equal(report.seasonAverages.digs,   15, 'Averages: digs mean = 15');
  assert.ok(Math.abs(report.seasonAverages.hittingPercentage! - 0.200) < 0.001, 'Averages: hittingPct mean = 0.200');
}

console.log('Season-averages case passed.');

// ─── No false positives on a flat sequence ────────────────────────────────────

{
  const report = generateSeasonIntelligence(makeTrends([
    { kills: 10, aces: 3, blocks: 4, digs: 12, hittingPercentage: 0.250 },
    { kills: 10, aces: 3, blocks: 4, digs: 12, hittingPercentage: 0.250 },
    { kills: 10, aces: 3, blocks: 4, digs: 12, hittingPercentage: 0.250 },
    { kills: 10, aces: 3, blocks: 4, digs: 12, hittingPercentage: 0.250 },
    { kills: 10, aces: 3, blocks: 4, digs: 12, hittingPercentage: 0.250 },
  ]));
  assert.equal(report.insights.length, 0, 'Flat sequence: no streak insights should fire');
  assert.equal(report.trajectory, 'mixed', 'Flat sequence: trajectory should be mixed (no change either way)');
}

console.log('No-false-positives case passed.');

console.log('All season intelligence tests passed.');
