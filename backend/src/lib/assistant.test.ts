import assert from 'node:assert/strict';
import { answerQuestion } from '../services/assistant.service';
import type { AssistantContext } from '../services/assistant.service';
import type { RotationStat } from '../services/rotation.service';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function rotStat(rotation: number, won: number, lost: number): RotationStat {
  const total = won + lost;
  return { rotation, won, lost, total, net: won - lost,
           efficiency: total > 0 ? Math.round((won / total) * 100) : null };
}

const BASE_CTX: AssistantContext = {
  teamRecommendations: [
    { category: 'attack', priority: 'high',   message: 'Attack hitting percentage is critically low.' },
    { category: 'serve',  priority: 'medium', message: 'Serve error rate is above the safe threshold.' },
  ],
  rotations: {
    rotations: [rotStat(1, 8, 2), rotStat(2, 3, 7), rotStat(3, 5, 5)],
    insights: {
      best:           rotStat(1, 8, 2),
      worst:          rotStat(2, 3, 7),
      highestSideOut: rotStat(1, 8, 2),
      lowestSideOut:  rotStat(2, 3, 7),
    },
  },
  seasonIntelligence: {
    seasonAverages: { kills: 12, aces: 3, blocks: 4, digs: 20, hittingPercentage: 0.250 },
    insights: [{ category: 'kills', message: 'Kills has improved for 4 consecutive matches.', direction: 'positive' }],
    trajectory: 'improving',
  },
  trainingRecommendations: [
    { focus: 'Attack efficiency',  category: 'attack', allocationPct: 20, rationale: 'Hitting % is critically low.' },
    { focus: 'Serve consistency',  category: 'serve',  allocationPct: 10, rationale: 'Serve error rate is high.'   },
  ],
  playerReports: [
    {
      playerName: 'Alice Torres',
      report: {
        strengths: ['defence'], weaknesses: ['attack'],
        mostImproved:  { category: 'passing', change: '↑ 1.40 → 1.95' },
        needsAttention:{ category: 'attack',  change: '↓ 0.250 → 0.120' },
        trend: 'stable',
      },
    },
    {
      playerName: 'Bob Marko',
      report: {
        strengths: ['serve'], weaknesses: [],
        mostImproved: null, needsAttention: null,
        trend: 'improving',
      },
    },
  ],
};

// ─── Weakest rotation ─────────────────────────────────────────────────────────

{
  const r = answerQuestion('What is our weakest rotation?', BASE_CTX);
  assert.equal(r.matchedIntent, 'weakest_rotation', 'weakest rotation: intent matched');
  assert.ok(r.answer.includes('2'), 'weakest rotation: answer cites rotation 2');
}

{
  const r = answerQuestion('show me the worst rotation', BASE_CTX);
  assert.equal(r.matchedIntent, 'weakest_rotation', '"worst rotation" also matches weakest_rotation');
}

console.log('Weakest-rotation cases passed.');

// ─── Best rotation ────────────────────────────────────────────────────────────

{
  const r = answerQuestion('What is our best rotation?', BASE_CTX);
  assert.equal(r.matchedIntent, 'best_rotation', 'best rotation: intent matched');
  assert.ok(r.answer.includes('1'), 'best rotation: answer cites rotation 1');
  assert.ok(r.answer.includes('80%') || r.answer.includes('8'), 'best rotation: answer includes efficiency or win count');
}

console.log('Best-rotation case passed.');

// ─── Most improved player ─────────────────────────────────────────────────────

{
  const r = answerQuestion('Who is our most improved player?', BASE_CTX);
  assert.equal(r.matchedIntent, 'most_improved_player', 'most improved: intent matched');
  assert.ok(r.answer.includes('Alice Torres'), 'most improved: names the right player');
  assert.ok(r.answer.includes('passing'), 'most improved: cites the improved category');
}

{
  // No player has mostImproved — should respond gracefully
  const ctx: AssistantContext = {
    ...BASE_CTX,
    playerReports: BASE_CTX.playerReports.map(({ playerName, report }) => ({
      playerName,
      report: { ...report, mostImproved: null },
    })),
  };
  const r = answerQuestion('who improved the most?', ctx);
  assert.equal(r.matchedIntent, 'most_improved_player', 'no-improved case: intent still matched');
  assert.ok(!r.answer.toLowerCase().includes('alice'), 'no-improved case: does not fabricate a player name');
  assert.ok(r.answer.length > 0, 'no-improved case: returns a non-empty graceful message');
}

console.log('Most-improved-player cases passed.');

// ─── Needs attention ──────────────────────────────────────────────────────────

{
  const r = answerQuestion('Which player is struggling the most?', BASE_CTX);
  assert.equal(r.matchedIntent, 'needs_attention', 'needs attention: intent matched');
  assert.ok(r.answer.includes('Alice Torres'), 'needs attention: names Alice Torres');
  assert.ok(r.answer.includes('attack'), 'needs attention: cites category');
}

{
  // No player needs attention
  const ctx: AssistantContext = {
    ...BASE_CTX,
    playerReports: BASE_CTX.playerReports.map(({ playerName, report }) => ({
      playerName,
      report: { ...report, needsAttention: null },
    })),
  };
  const r = answerQuestion('who needs work?', ctx);
  assert.equal(r.matchedIntent, 'needs_attention', 'no-attention case: intent matched');
  assert.ok(r.answer.toLowerCase().includes('no') || r.answer.toLowerCase().includes('great'),
    'no-attention case: graceful positive message');
}

console.log('Needs-attention cases passed.');

// ─── Training focus ───────────────────────────────────────────────────────────

{
  const r = answerQuestion('What should we practice this week?', BASE_CTX);
  assert.equal(r.matchedIntent, 'training_focus', 'training focus: intent matched');
  assert.ok(r.answer.includes('20%') || r.answer.includes('Attack'), 'training focus: cites top allocation or category');
}

{
  const ctx: AssistantContext = { ...BASE_CTX, trainingRecommendations: [] };
  const r = answerQuestion('what should we focus on in practice?', ctx);
  assert.equal(r.matchedIntent, 'training_focus');
  assert.ok(r.answer.toLowerCase().includes('no') || r.answer.toLowerCase().includes('healthy'),
    'empty training: graceful message');
}

console.log('Training-focus cases passed.');

// ─── Season trend ─────────────────────────────────────────────────────────────

{
  const r = answerQuestion('Are we improving this season?', BASE_CTX);
  assert.equal(r.matchedIntent, 'season_trend', 'season trend: intent matched');
  assert.ok(r.answer.toLowerCase().includes('improving'), 'season trend: answer reflects improving trajectory');
}

{
  const ctx: AssistantContext = {
    ...BASE_CTX,
    seasonIntelligence: { ...BASE_CTX.seasonIntelligence, trajectory: 'insufficient_data' },
  };
  const r = answerQuestion('how is the season going?', ctx);
  assert.equal(r.matchedIntent, 'season_trend');
  assert.ok(r.answer.toLowerCase().includes('not enough') || r.answer.toLowerCase().includes('5'),
    'insufficient_data season: explains the gap gracefully');
}

console.log('Season-trend cases passed.');

// ─── Team weaknesses ──────────────────────────────────────────────────────────

{
  const r = answerQuestion('What are our biggest weaknesses?', BASE_CTX);
  assert.equal(r.matchedIntent, 'team_weaknesses', 'team weaknesses: intent matched');
  assert.ok(r.answer.includes('attack') || r.answer.includes('Attack'),
    'team weaknesses: mentions attack (high priority)');
}

console.log('Team-weaknesses case passed.');

// ─── No match ─────────────────────────────────────────────────────────────────

{
  const r = answerQuestion('Who is the tallest player on the team?', BASE_CTX);
  assert.equal(r.matchedIntent, null, 'no match: matchedIntent is null');
  assert.ok(r.answer.includes('•'), "no match: help text lists example questions with '•' bullets");
}

console.log('No-match case passed.');

// ─── Keyword disambiguation ───────────────────────────────────────────────────
// "rotation" appears in both rotation intents; ensure "best rotation" does not
// accidentally match "weakest_rotation", and vice versa.

{
  const weak = answerQuestion('worst rotation please', BASE_CTX);
  const best = answerQuestion('best rotation please', BASE_CTX);
  assert.equal(weak.matchedIntent, 'weakest_rotation', 'disambiguation: "worst" → weakest_rotation');
  assert.equal(best.matchedIntent, 'best_rotation',    'disambiguation: "best" → best_rotation');
}

console.log('Disambiguation case passed.');

console.log('All assistant tests passed.');
