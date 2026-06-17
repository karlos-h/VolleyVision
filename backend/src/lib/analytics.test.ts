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
