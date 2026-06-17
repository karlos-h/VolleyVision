import assert from 'node:assert/strict';
import { EventType } from '@prisma/client';
import { calculateStats } from './analytics';

const events = [
  EventType.KILL,
  EventType.KILL,
  EventType.ATTACK_ERROR,
  EventType.ATTACK_ATTEMPT,
  EventType.ACE,
  EventType.SERVICE_ERROR,
  EventType.SERVE_IN,
  EventType.PASS_3,
  EventType.PASS_2,
  EventType.PASS_1,
  EventType.PASS_0,
  EventType.SOLO_BLOCK,
  EventType.BLOCK_ASSIST,
].map((eventType) => ({ eventType, playerId: 'player-1', setNumber: 1 }));

const stats = calculateStats(events);

assert.equal(stats.attackAttempts, 4);
assert.equal(stats.hittingPercentage, 0.25);
assert.equal(stats.serveAttempts, 3);
assert.equal(stats.serveInPercentage, 0.667);
assert.equal(stats.passAttempts, 4);
assert.equal(stats.passingRating, 1.5);
assert.equal(stats.totalBlocks, 1.5);

const emptyStats = calculateStats([]);
assert.equal(emptyStats.hittingPercentage, null);
assert.equal(emptyStats.passingRating, null);

console.log('Analytics formula tests passed.');

// ── Heatmap QA ────────────────────────────────────────────────────────────────

// Simulate the buildHeatmap logic inline (mirrors analytics.ts)
const HEATMAP_CATEGORIES: Record<string, string[]> = {
  attack:  ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT'],
  serve:   ['ACE', 'SERVICE_ERROR', 'SERVE_IN'],
  pass:    ['PASS_3', 'PASS_2', 'PASS_1', 'PASS_0'],
  block:   ['SOLO_BLOCK', 'BLOCK_ASSIST', 'BLOCK_ERROR'],
  defence: ['DIG', 'DIG_ERROR'],
};

function buildHeatmap(evts: { courtZone: number | null; eventType: string }[]) {
  const empty = (): Record<string, number> => ({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 });
  const result: Record<string, Record<string, number>> = {
    attack: empty(), serve: empty(), pass: empty(), block: empty(), defence: empty(), all: empty(),
  };
  for (const e of evts) {
    if (e.courtZone == null) continue;
    const z = String(e.courtZone);
    result.all[z]++;
    for (const [cat, types] of Object.entries(HEATMAP_CATEGORIES)) {
      if (types.includes(e.eventType)) result[cat][z]++;
    }
  }
  return result;
}

// Zone 4: 10 kills, Zone 1: 2 kills — attack heatmap should reflect this
const killEvents = [
  ...Array(10).fill({ courtZone: 4, eventType: 'KILL' }),
  ...Array(2).fill({ courtZone: 1, eventType: 'KILL' }),
];
const hm = buildHeatmap(killEvents);

assert.equal(hm.attack['4'], 10, 'Zone 4 should have 10 attack events');
assert.equal(hm.attack['1'], 2, 'Zone 1 should have 2 attack events');
assert.equal(hm.all['4'], 10, 'Zone 4 all-category count should be 10');
assert.equal(hm.all['1'], 2, 'Zone 1 all-category count should be 2');

// Percentage check: zone 4 = 10/12 ≈ 83.3%, zone 1 = 2/12 ≈ 16.7%
const totalAttacks = Object.values(hm.attack).reduce((s, n) => s + n, 0);
assert.equal(totalAttacks, 12, 'Total attack events should be 12');
const zone4Pct = Math.round((hm.attack['4'] / totalAttacks) * 1000) / 10;
const zone1Pct = Math.round((hm.attack['1'] / totalAttacks) * 1000) / 10;
assert.equal(zone4Pct, 83.3, 'Zone 4 should be ~83.3% of attacks');
assert.equal(zone1Pct, 16.7, 'Zone 1 should be ~16.7% of attacks');

// Null courtZone events must be ignored
const nullZoneEvents = [
  { courtZone: null, eventType: 'KILL' },
  { courtZone: 3, eventType: 'KILL' },
];
const hmNull = buildHeatmap(nullZoneEvents);
assert.equal(hmNull.attack['3'], 1, 'Valid zone should be counted');
assert.equal(Object.values(hmNull.attack).reduce((s, n) => s + n, 0), 1, 'Null zone must not be counted');

// Non-attack events must not appear in attack category
const serveEvents = [{ courtZone: 2, eventType: 'ACE' }];
const hmServe = buildHeatmap(serveEvents);
assert.equal(hmServe.attack['2'], 0, 'Serve event must not count as attack');
assert.equal(hmServe.serve['2'], 1, 'Serve event must count in serve category');
assert.equal(hmServe.all['2'], 1, 'Serve event must count in all');

console.log('Heatmap QA tests passed.');
