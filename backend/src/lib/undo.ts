// Pure helpers for "undo the last thing that happened" on a live match.
//
// A match has TWO independent action logs, and the tracker's single Undo button
// has to reach into whichever one holds the most recent action:
//   - Event            — a recorded stat (kill, dig…), timestamped `recordedAt`
//   - ScoreAdjustment  — a manual score tap (+1 / −), timestamped `createdAt`
//
// Undo used to look only at Event, so a score tap was invisible to it and it
// would silently reverse the older stat event instead.
//
// Kept free of Prisma — like lib/scoreReplay.ts and lib/setOperations.ts — so
// `npm test` can exercise the rules without a database.

export interface UndoCandidateEvent {
  recordedAt: Date;
}

export interface UndoCandidateAdjustment {
  createdAt: Date;
}

export type UndoTargetKind = 'event' | 'adjustment' | null;

/**
 * Picks which log holds the match's most recent action, or null when both are
 * empty and there is genuinely nothing to undo.
 *
 * Ties: the two logs are written by different endpoints and their timestamps
 * come from different clocks, so an exact tie carries no real ordering. We
 * settle it toward the adjustment because that reversal is non-destructive —
 * a mis-undone score tap is one tap to restore, whereas undoing an event
 * deletes a stat row outright. Arbitrary, but deterministic and recoverable.
 */
export function resolveUndoTarget(
  latestEvent: UndoCandidateEvent | null | undefined,
  latestAdjustment: UndoCandidateAdjustment | null | undefined,
): UndoTargetKind {
  if (!latestEvent && !latestAdjustment) return null;
  if (!latestAdjustment) return 'event';
  if (!latestEvent) return 'adjustment';

  return latestEvent.recordedAt.getTime() > latestAdjustment.createdAt.getTime()
    ? 'event'
    : 'adjustment';
}

/**
 * Inverts a ScoreAdjustment's effect on the running score.
 *
 * The stored delta is `new - old`, so undoing subtracts it back off: an
 * adjustment of −1 undoes to +1, not to another −1. Clamped at zero, matching
 * every other score path.
 */
export function reverseAdjustmentScore(
  state: { homeScore: number; awayScore: number },
  adjustment: { homeDelta: number; awayDelta: number },
): { homeScore: number; awayScore: number } {
  return {
    homeScore: Math.max(0, state.homeScore - adjustment.homeDelta),
    awayScore: Math.max(0, state.awayScore - adjustment.awayDelta),
  };
}
