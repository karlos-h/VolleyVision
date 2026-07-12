import assert from 'node:assert/strict';
import { generateTrainingRecommendations } from '../services/trainingRecommendations.service';
import type { Recommendation } from '../services/coachingRecommendations.service';
import type { PlayerDevelopmentReport } from '../services/playerDevelopment.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rec(
  category: Recommendation['category'],
  priority: Recommendation['priority'],
  message = 'test message',
): Recommendation {
  return { category, priority, message };
}

function playerReport(
  weaknesses: string[],
  trend: PlayerDevelopmentReport['trend'] = 'stable',
): PlayerDevelopmentReport {
  return { strengths: [], weaknesses, mostImproved: null, needsAttention: null, trend };
}

// ─── Empty input ──────────────────────────────────────────────────────────────

{
  const result = generateTrainingRecommendations({ teamRecommendations: [] });
  assert.deepEqual(result, [], 'Empty input: returns empty array');
}

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [],
    playerReports: [
      { playerName: 'Alice', report: playerReport(['serve']) }, // only 1 player — no shared weakness
    ],
  });
  assert.deepEqual(result, [], 'Single-player weakness (not shared): returns empty array');
}

console.log('Empty-input cases passed.');

// ─── Single high-priority recommendation ─────────────────────────────────────

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [rec('attack', 'high', 'Attack efficiency is critical.')],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].category, 'attack');
  assert.equal(result[0].allocationPct, 20, 'High priority maps to 20%');
  assert.ok(result[0].rationale.includes('Attack efficiency is critical.'));
}

console.log('Single high-priority case passed.');

// ─── Merging two recommendations in the same category ─────────────────────────

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [
      rec('serve', 'high',   'Serve error rate critical.'),
      rec('serve', 'medium', 'Serve consistency needs work.'),
    ],
  });
  // Should produce exactly ONE serve item, with high-priority allocation
  const serveItems = result.filter((r) => r.category === 'serve');
  assert.equal(serveItems.length, 1, 'Two recs in same category merge into one item');
  assert.equal(serveItems[0].allocationPct, 20, 'Merged item uses highest priority (high → 20%)');
  assert.ok(serveItems[0].rationale.includes('Serve error rate critical.'), 'Rationale includes first message');
  assert.ok(serveItems[0].rationale.includes('Serve consistency needs work.'), 'Rationale includes second message');
}

console.log('Category-merge case passed.');

// ─── 60% cap and proportional scaling ─────────────────────────────────────────
// 4 × high-priority (20% each) = 80% raw → should be capped at 60 total.

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [
      rec('attack',   'high'),
      rec('serve',    'high'),
      rec('pass',     'high'),
      rec('defence',  'high'),
    ],
  });
  const total = result.reduce((s, r) => s + r.allocationPct, 0);
  assert.ok(total <= 60, `Total after scaling must be ≤ 60 (got ${total})`);
  assert.ok(total >= 55, `Total after scaling should be close to 60 (got ${total})`);
}

console.log('60%-cap scaling case passed.');

// ─── Shared player weakness → player_development item ─────────────────────────

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [],
    playerReports: [
      { playerName: 'Alice', report: playerReport(['passing'],  'stable')  },
      { playerName: 'Bob',   report: playerReport(['passing'],  'declining') },
      { playerName: 'Carol', report: playerReport(['serving'],  'stable')  },
    ],
  });
  // 2 players share 'passing' weakness → 1 player_development item
  assert.equal(result.length, 1, 'Two players sharing same weakness creates one player_development item');
  assert.equal(result[0].category, 'player_development');
  assert.equal(result[0].allocationPct, 10);
  assert.ok(result[0].rationale.includes('2 players'), 'Rationale cites player count');
  assert.ok(result[0].rationale.includes('Alice'), 'Rationale names player Alice');
  assert.ok(result[0].rationale.includes('Bob'),   'Rationale names player Bob');
}

console.log('Shared-player-weakness case passed.');

// ─── Insufficient-data players are excluded from shared-weakness count ─────────

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [],
    playerReports: [
      { playerName: 'Alice', report: playerReport(['passing'], 'stable')            },
      { playerName: 'Bob',   report: playerReport(['passing'], 'insufficient_data') }, // excluded
    ],
  });
  // Only Alice counts — insufficient_data Bob must not be counted
  assert.deepEqual(result, [], 'insufficient_data player is excluded from shared-weakness count');
}

console.log('Insufficient-data exclusion case passed.');

// ─── Sort order: highest allocationPct first ──────────────────────────────────

{
  const result = generateTrainingRecommendations({
    teamRecommendations: [
      rec('attack',   'high'),    // 20%
      rec('serve',    'medium'),  // 10%
      rec('rotation', 'medium'),  // 10%
    ],
    playerReports: [
      { playerName: 'Alice', report: playerReport(['passing'], 'stable')   },
      { playerName: 'Bob',   report: playerReport(['passing'], 'declining') },
    ],
  });
  // attack(20) should be first; subsequent order is 10% items
  assert.equal(result[0].category, 'attack', 'Highest allocation item is first');
  for (let i = 1; i < result.length; i++) {
    assert.ok(
      result[i - 1].allocationPct >= result[i].allocationPct,
      `Items are sorted by allocationPct descending (index ${i})`,
    );
  }
}

console.log('Sort-order case passed.');

console.log('All training recommendations tests passed.');
