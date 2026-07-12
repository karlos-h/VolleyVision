import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { replayTimeline, buildTimeline } from './scoreReplay';
import type { ReplayItem } from './scoreReplay';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let clock = 0;
function nextDate() {
  clock += 1000;
  return new Date(clock);
}

function evt(eventType: string, isOpponentEvent = false): ReplayItem {
  return { kind: 'event', eventType, isOpponentEvent, at: nextDate() };
}

function adj(homeDelta: number, awayDelta: number): ReplayItem {
  return { kind: 'adjustment', homeDelta, awayDelta, at: nextDate() };
}

// ─── Core requirement: adjustments survive undo ───────────────────────────────

describe('replayTimeline — manual adjustments survive undo', () => {
  it('adjust → record event → undo → adjusted score survives', () => {
    // Coach adjusts +2 home (e.g. missed points), then a kill is recorded.
    const timeline = [
      evt('KILL'),        // home 1-0
      adj(2, 0),          // home 3-0 (manual correction)
      evt('KILL'),        // home 4-0
    ];

    const full = replayTimeline(timeline);
    assert.equal(full.homeScore, 4);
    assert.equal(full.awayScore, 0);

    // Undo the last kill (recalculate replays the remaining timeline).
    const afterUndo = replayTimeline(timeline.slice(0, -1));
    assert.equal(afterUndo.homeScore, 3, 'adjustment must survive the undo');
    assert.equal(afterUndo.awayScore, 0);
  });

  it('away-side adjustment also survives undo', () => {
    const timeline = [
      evt('ATTACK_ERROR'), // away 0-1
      adj(0, 3),           // away 0-4
      evt('KILL'),         // home 1-4
    ];
    const afterUndo = replayTimeline(timeline.slice(0, -1));
    assert.equal(afterUndo.homeScore, 0);
    assert.equal(afterUndo.awayScore, 4, 'away adjustment must survive the undo');
  });

  it('negative adjustment (score correction downward) survives undo', () => {
    const timeline = [
      evt('KILL'), evt('KILL'), evt('KILL'), // home 3-0
      adj(-1, 0),                            // home 2-0 (correcting a mistaken point)
      evt('ATTACK_ERROR'),                   // away 2-1
    ];
    const afterUndo = replayTimeline(timeline.slice(0, -1));
    assert.equal(afterUndo.homeScore, 2, 'downward correction must survive');
    assert.equal(afterUndo.awayScore, 0);
  });
});

// ─── Adjustment mechanics ─────────────────────────────────────────────────────

describe('replayTimeline — adjustment mechanics', () => {
  it('adjustment can never push a score below zero', () => {
    const result = replayTimeline([evt('KILL'), adj(-5, -5)]);
    assert.equal(result.homeScore, 0);
    assert.equal(result.awayScore, 0);
  });

  it('an adjustment can complete a set', () => {
    // 24-0, then +1 home via adjustment → 25-0 set win, scores reset
    const timeline: ReplayItem[] = [
      ...Array.from({ length: 24 }, () => evt('KILL')),
      adj(1, 0),
    ];
    const result = replayTimeline(timeline);
    assert.equal(result.homeSetsWon, 1, 'adjustment must be able to complete a set');
    assert.equal(result.homeScore, 0, 'score resets after set win');
    assert.deepEqual(result.setScores, [{ set: 1, home: 25, away: 0 }]);
  });

  it('zero-delta adjustment changes nothing', () => {
    const result = replayTimeline([evt('KILL'), adj(0, 0)]);
    assert.equal(result.homeScore, 1);
    assert.equal(result.awayScore, 0);
  });

  it('opponent events and adjustments compose correctly', () => {
    const timeline = [
      evt('KILL', true),          // opponent kill → away 0-1
      evt('SERVICE_ERROR', true), // opponent error → home 1-1
      adj(1, 0),                  // home 2-1
    ];
    const result = replayTimeline(timeline);
    assert.equal(result.homeScore, 2);
    assert.equal(result.awayScore, 1);
  });
});

// ─── Timeline merging ─────────────────────────────────────────────────────────

describe('buildTimeline', () => {
  it('merges events and adjustments in chronological order', () => {
    const events = [
      { eventType: 'KILL', isOpponentEvent: false, recordedAt: new Date(1000) },
      { eventType: 'KILL', isOpponentEvent: false, recordedAt: new Date(3000) },
    ];
    const adjustments = [
      { homeDelta: 1, awayDelta: 0, createdAt: new Date(2000) },
    ];
    const timeline = buildTimeline(events, adjustments);
    assert.equal(timeline.length, 3);
    assert.equal(timeline[0].kind, 'event');
    assert.equal(timeline[1].kind, 'adjustment');
    assert.equal(timeline[2].kind, 'event');
  });

  it('empty inputs produce an empty timeline and zeroed state', () => {
    const timeline = buildTimeline([], []);
    assert.deepEqual(timeline, []);
    const result = replayTimeline(timeline);
    assert.equal(result.homeScore, 0);
    assert.equal(result.awayScore, 0);
    assert.equal(result.completed, false);
  });
});
