import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveUndoTarget, reverseAdjustmentScore } from './undo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const evt = (ms: number) => ({ recordedAt: new Date(ms) });
const adj = (ms: number) => ({ createdAt: new Date(ms) });

// ─── resolveUndoTarget ────────────────────────────────────────────────────────

describe('resolveUndoTarget', () => {
  it('returns null when the match has no actions at all', () => {
    assert.equal(resolveUndoTarget(null, null), null);
    assert.equal(resolveUndoTarget(undefined, undefined), null);
  });

  it('picks the event when there are no adjustments (the original behaviour)', () => {
    assert.equal(resolveUndoTarget(evt(1000), null), 'event');
  });

  it('picks the adjustment when no stat events have been recorded yet', () => {
    // A match can be scored purely by tapping, with zero Events — this is the
    // case the old event-only lookup reported as "nothing to undo".
    assert.equal(resolveUndoTarget(null, adj(1000)), 'adjustment');
  });

  it('picks the score tap when it is the most recent action', () => {
    // The reported bug: stat event, then a − tap. Undo must reverse the tap,
    // not reach past it to the older kill.
    assert.equal(resolveUndoTarget(evt(1000), adj(2000)), 'adjustment');
  });

  it('picks the stat event when it is the most recent action', () => {
    assert.equal(resolveUndoTarget(evt(2000), adj(1000)), 'event');
  });

  it('is deterministic when the timestamps tie exactly', () => {
    // The two logs are written by different endpoints, so an exact tie carries
    // no real ordering. It must still resolve the same way every time.
    const result = resolveUndoTarget(evt(1000), adj(1000));
    assert.equal(result, 'adjustment');
    for (let i = 0; i < 20; i++) {
      assert.equal(resolveUndoTarget(evt(1000), adj(1000)), result, 'tie-break must be stable');
    }
  });

  it('resolves a tie toward the non-destructive reversal', () => {
    // Undoing an adjustment is one tap to restore; undoing an event deletes a
    // stat row outright. The tie-break deliberately favours the recoverable one.
    assert.equal(resolveUndoTarget(evt(5000), adj(5000)), 'adjustment');
  });

  it('compares by time value, not object identity or insertion order', () => {
    assert.equal(resolveUndoTarget(evt(1000), adj(1001)), 'adjustment');
    assert.equal(resolveUndoTarget(evt(1001), adj(1000)), 'event');
  });
});

// ─── reverseAdjustmentScore ───────────────────────────────────────────────────

describe('reverseAdjustmentScore', () => {
  it('undoes a − tap by adding the point back', () => {
    // The bug this guards: undoing a -1 must go UP, not subtract again.
    const next = reverseAdjustmentScore({ homeScore: 4, awayScore: 2 }, { homeDelta: -1, awayDelta: 0 });
    assert.equal(next.homeScore, 5, 'a -1 adjustment undoes to +1');
    assert.equal(next.awayScore, 2, 'the other side is untouched');
  });

  it('undoes a +1 tap by taking the point back off', () => {
    const next = reverseAdjustmentScore({ homeScore: 5, awayScore: 2 }, { homeDelta: 1, awayDelta: 0 });
    assert.equal(next.homeScore, 4);
    assert.equal(next.awayScore, 2);
  });

  it('reverses away-side adjustments in the same way', () => {
    assert.equal(reverseAdjustmentScore({ homeScore: 3, awayScore: 7 }, { homeDelta: 0, awayDelta: -1 }).awayScore, 8);
    assert.equal(reverseAdjustmentScore({ homeScore: 3, awayScore: 7 }, { homeDelta: 0, awayDelta: 1 }).awayScore, 6);
  });

  it('reverses both sides at once', () => {
    const next = reverseAdjustmentScore({ homeScore: 10, awayScore: 10 }, { homeDelta: 3, awayDelta: -2 });
    assert.equal(next.homeScore, 7);
    assert.equal(next.awayScore, 12);
  });

  it('reverses a multi-point correction, not just a single tap', () => {
    // updateScore takes absolute values, so a jump from 5 to 12 stores +7.
    const next = reverseAdjustmentScore({ homeScore: 12, awayScore: 0 }, { homeDelta: 7, awayDelta: 0 });
    assert.equal(next.homeScore, 5);
  });

  it('clamps at zero rather than going negative', () => {
    const next = reverseAdjustmentScore({ homeScore: 0, awayScore: 0 }, { homeDelta: 2, awayDelta: 2 });
    assert.equal(next.homeScore, 0);
    assert.equal(next.awayScore, 0);
  });

  it('leaves the score alone for a zero-delta adjustment', () => {
    const next = reverseAdjustmentScore({ homeScore: 6, awayScore: 4 }, { homeDelta: 0, awayDelta: 0 });
    assert.equal(next.homeScore, 6);
    assert.equal(next.awayScore, 4);
  });

  it('round-trips: applying a delta then reversing it restores the score', () => {
    for (const delta of [-3, -1, 0, 1, 5]) {
      const start = { homeScore: 8, awayScore: 8 };
      const applied = { homeScore: start.homeScore + delta, awayScore: start.awayScore };
      const reversed = reverseAdjustmentScore(applied, { homeDelta: delta, awayDelta: 0 });
      assert.equal(reversed.homeScore, start.homeScore, `delta ${delta} must round-trip`);
    }
  });

  it('does not mutate the state it is given', () => {
    const state = { homeScore: 4, awayScore: 2 };
    reverseAdjustmentScore(state, { homeDelta: -1, awayDelta: 0 });
    assert.deepEqual(state, { homeScore: 4, awayScore: 2 });
  });
});
