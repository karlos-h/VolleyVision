import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveUndoTarget,
  reverseAdjustmentScore,
  reverseCompletingAction,
  scoringSideDelta,
} from './undo';
import type { MatchScoreState } from './setOperations';
import { checkMatchIntegrity } from './matchIntegrity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const evt = (ms: number) => ({ recordedAt: new Date(ms) });
const adj = (ms: number) => ({ createdAt: new Date(ms) });

function state(overrides: Partial<MatchScoreState> = {}): MatchScoreState {
  return {
    homeScore: 0,
    awayScore: 0,
    homeSetsWon: 0,
    awaySetsWon: 0,
    setScores: [],
    status: 'IN_PROGRESS',
    ...overrides,
  };
}

/** Every reversal must leave the match in a state matchIntegrity accepts. */
function assertIntegrity(s: MatchScoreState, label: string) {
  const result = checkMatchIntegrity({
    homeScore: s.homeScore,
    awayScore: s.awayScore,
    homeSetsWon: s.homeSetsWon,
    awaySetsWon: s.awaySetsWon,
    status: s.status,
    setScores: s.setScores,
  });
  assert.ok(result.ok, `${label} violated match integrity: ${result.violations.join('; ')}`);
}

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
    const before = { homeScore: 4, awayScore: 2 };
    reverseAdjustmentScore(before, { homeDelta: -1, awayDelta: 0 });
    assert.deepEqual(before, { homeScore: 4, awayScore: 2 });
  });
});

// ─── scoringSideDelta ─────────────────────────────────────────────────────────

describe('scoringSideDelta', () => {
  it('expresses each scoring side as a delta', () => {
    assert.deepEqual(scoringSideDelta('home'), { homeDelta: 1, awayDelta: 0 });
    assert.deepEqual(scoringSideDelta('away'), { homeDelta: 0, awayDelta: 1 });
  });

  it('is a no-op delta for non-scoring events', () => {
    // Digs/passes/assists score nothing, so they can never complete a set.
    assert.deepEqual(scoringSideDelta(null), { homeDelta: 0, awayDelta: 0 });
  });
});

// ─── reverseCompletingAction — undoing the point that closed a set ────────────

describe('reverseCompletingAction', () => {
  // The shape the bug produced: a tap took home 24 → 25, checkSetCompletion
  // fired, zeroed the running score and banked {set 1, 25-20}. Undoing against
  // that zeroed score gave 0 - 1 → 0 and left the set banked.
  const afterCompletingTap = () =>
    state({
      homeScore: 0,
      awayScore: 0,
      homeSetsWon: 1,
      awaySetsWon: 0,
      setScores: [{ set: 1, home: 25, away: 20 }],
    });

  it('restores the score to just BEFORE the closing point', () => {
    const next = reverseCompletingAction(afterCompletingTap(), { homeDelta: 1, awayDelta: 0 })!;
    assert.equal(next.homeScore, 24, 'banked 25 minus the point that earned it');
    assert.equal(next.awayScore, 20, 'the other side is untouched');
  });

  it('un-banks the set and takes it back off the winner', () => {
    const next = reverseCompletingAction(afterCompletingTap(), { homeDelta: 1, awayDelta: 0 })!;
    assert.equal(next.homeSetsWon, 0, 'the set is handed back');
    assert.equal(next.awaySetsWon, 0);
    assert.deepEqual(next.setScores, [], 'the banked entry is popped');
    assertIntegrity(next, 'reverseCompletingAction');
  });

  it('does NOT clamp to zero the way a plain reversal does', () => {
    // Regression guard for the exact defect: reversing against the current
    // (zeroed) score gives 0; the banked entry is the right baseline.
    const plain = reverseAdjustmentScore(afterCompletingTap(), { homeDelta: 1, awayDelta: 0 });
    assert.equal(plain.homeScore, 0, 'the plain path really does land on 0');
    const fixed = reverseCompletingAction(afterCompletingTap(), { homeDelta: 1, awayDelta: 0 })!;
    assert.equal(fixed.homeScore, 24, 'the fixed path lands on the real pre-point score');
  });

  it('hands the set back to away when away won it', () => {
    const next = reverseCompletingAction(
      state({ homeSetsWon: 0, awaySetsWon: 1, setScores: [{ set: 1, home: 23, away: 25 }] }),
      { homeDelta: 0, awayDelta: 1 },
    )!;
    assert.equal(next.awaySetsWon, 0);
    assert.equal(next.homeSetsWon, 0);
    assert.equal(next.homeScore, 23);
    assert.equal(next.awayScore, 24, 'away 25 minus the point that earned it');
    assertIntegrity(next, 'reverseCompletingAction away');
  });

  it('keeps earlier sets and only pops the one just completed', () => {
    const next = reverseCompletingAction(
      state({
        homeSetsWon: 2, awaySetsWon: 1,
        setScores: [
          { set: 1, home: 25, away: 20 },
          { set: 2, home: 20, away: 25 },
          { set: 3, home: 25, away: 18 },
        ],
      }),
      { homeDelta: 1, awayDelta: 0 },
    )!;
    assert.equal(next.setScores.length, 2, 'only the last entry is popped');
    assert.deepEqual(next.setScores.map((s) => s.set), [1, 2]);
    assert.equal(next.homeSetsWon, 1);
    assert.equal(next.awaySetsWon, 1, 'away keeps the set it won');
    assert.equal(next.homeScore, 24);
    assert.equal(next.awayScore, 18);
    assertIntegrity(next, 'reverseCompletingAction mid-match');
  });

  it('reopens the match when the undone set is the one that won it', () => {
    const next = reverseCompletingAction(
      state({
        homeSetsWon: 3, awaySetsWon: 1,
        status: 'COMPLETED',
        setScores: [
          { set: 1, home: 25, away: 20 },
          { set: 2, home: 20, away: 25 },
          { set: 3, home: 25, away: 18 },
          { set: 4, home: 25, away: 22 },
        ],
      }),
      { homeDelta: 1, awayDelta: 0 },
    )!;
    assert.equal(next.homeSetsWon, 2);
    assert.equal(next.status, 'IN_PROGRESS', 'the match reopens');
    assert.equal(next.homeScore, 24, 'play resumes at match point');
    assert.equal(next.awayScore, 22);
    assertIntegrity(next, 'reverseCompletingAction match point');
  });

  it('leaves an in-progress match in progress', () => {
    const next = reverseCompletingAction(afterCompletingTap(), { homeDelta: 1, awayDelta: 0 })!;
    assert.equal(next.status, 'IN_PROGRESS');
  });

  it('handles a deciding set won at 15', () => {
    const next = reverseCompletingAction(
      state({
        homeSetsWon: 3, awaySetsWon: 2,
        status: 'COMPLETED',
        setScores: [
          { set: 1, home: 25, away: 20 }, { set: 2, home: 20, away: 25 },
          { set: 3, home: 25, away: 18 }, { set: 4, home: 20, away: 25 },
          { set: 5, home: 15, away: 12 },
        ],
      }),
      { homeDelta: 1, awayDelta: 0 },
    )!;
    assert.equal(next.homeScore, 14, 'deciding set resumes at 14-12');
    assert.equal(next.awayScore, 12);
    assert.equal(next.homeSetsWon, 2);
    assert.equal(next.status, 'IN_PROGRESS');
    assertIntegrity(next, 'reverseCompletingAction deciding set');
  });

  it('reverses a multi-point tap that jumped straight to the win', () => {
    // updateScore takes absolutes: 21 → 25 stores +4 and completes the set.
    const next = reverseCompletingAction(
      state({ homeSetsWon: 1, setScores: [{ set: 1, home: 25, away: 20 }] }),
      { homeDelta: 4, awayDelta: 0 },
    )!;
    assert.equal(next.homeScore, 21, 'restores the score from before the whole jump');
    assert.equal(next.homeSetsWon, 0);
  });

  it('returns null when there is no banked entry to rebuild from', () => {
    // Defensive: the flag says it completed a set but the history disagrees.
    // The caller falls back to a plain reversal rather than corrupt set state.
    assert.equal(reverseCompletingAction(state({ homeSetsWon: 1 }), { homeDelta: 1, awayDelta: 0 }), null);
  });

  it('returns null on a level banked entry, which has no winner', () => {
    assert.equal(
      reverseCompletingAction(
        state({ homeSetsWon: 1, setScores: [{ set: 1, home: 25, away: 25 }] }),
        { homeDelta: 1, awayDelta: 0 },
      ),
      null,
    );
  });

  it('round-trips a completion: complete then undo restores the prior state', () => {
    // 24-20, home scores → set completes → undo → back to 24-20, nothing banked.
    const beforePoint = state({ homeScore: 24, awayScore: 20 });
    const undone = reverseCompletingAction(afterCompletingTap(), { homeDelta: 1, awayDelta: 0 })!;
    assert.equal(undone.homeScore, beforePoint.homeScore);
    assert.equal(undone.awayScore, beforePoint.awayScore);
    assert.equal(undone.homeSetsWon, beforePoint.homeSetsWon);
    assert.deepEqual(undone.setScores, beforePoint.setScores);
    assert.equal(undone.status, beforePoint.status);
  });

  it('does not mutate the state or setScores it is given', () => {
    const s = afterCompletingTap();
    reverseCompletingAction(s, { homeDelta: 1, awayDelta: 0 });
    assert.equal(s.homeSetsWon, 1);
    assert.deepEqual(s.setScores, [{ set: 1, home: 25, away: 20 }]);
  });
});
