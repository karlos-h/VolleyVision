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

import { SETS_TO_WIN_MATCH } from './setOperations';
import type { MatchScoreState } from './setOperations';

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

/** A score-affecting action expressed as its effect on each side's score. */
export interface ScoreDelta {
  homeDelta: number;
  awayDelta: number;
}

/**
 * Undoes the point that CLOSED a set — the case a plain delta reversal gets
 * wrong.
 *
 * When checkSetCompletion fires it zeroes the running score, banks a setScores
 * entry and awards the set, all in the same request as the point that triggered
 * it. Reversing that point against the match's current score is then reversing
 * against the wrong baseline: the score is already 0, so `0 - delta` clamps to
 * 0 and the banked set stays put.
 *
 * The banked entry is the missing baseline. Its home/away are the exact score
 * at completion — after the closing point — so subtracting that point's own
 * delta lands on the score as it stood just before it. From there we undo the
 * rest of the completion: pop the entry, take the set back off whoever won it,
 * and reopen the match if this is the set that finished it.
 *
 * Callers only reach this when the action carries `completedSet`, recorded at
 * the time (see lib/scoring.ts) rather than guessed at afterwards. Returns null
 * if there is no banked entry to work from, so callers can fall back to a plain
 * reversal rather than corrupting set state.
 */
export function reverseCompletingAction(
  state: MatchScoreState,
  delta: ScoreDelta,
): MatchScoreState | null {
  if (state.setScores.length === 0) return null;

  const ordered = [...state.setScores].sort((a, b) => a.set - b.set);
  const completed = ordered[ordered.length - 1];

  // Completion needs a 2-point lead, so a banked entry is never level. If some
  // legacy row is, there's no winner to hand the set back to — bail out and let
  // the caller do the plain reversal instead of guessing.
  if (completed.home === completed.away) return null;
  const winner = completed.home > completed.away ? 'home' : 'away';

  const homeSetsWon = Math.max(0, state.homeSetsWon - (winner === 'home' ? 1 : 0));
  const awaySetsWon = Math.max(0, state.awaySetsWon - (winner === 'away' ? 1 : 0));
  const stillWon = homeSetsWon >= SETS_TO_WIN_MATCH || awaySetsWon >= SETS_TO_WIN_MATCH;

  return {
    // The banked score minus this action's own contribution: the score as it
    // was before the closing point, not after it.
    homeScore: Math.max(0, completed.home - delta.homeDelta),
    awayScore: Math.max(0, completed.away - delta.awayDelta),
    homeSetsWon,
    awaySetsWon,
    setScores: ordered.slice(0, -1),
    // Only reopen if this completion is what won the match — a match already
    // decided by an earlier set stays COMPLETED.
    status: state.status === 'COMPLETED' && !stillWon ? 'IN_PROGRESS' : state.status,
  };
}

/** The score contribution of a scoring side, as a delta. */
export function scoringSideDelta(side: 'home' | 'away' | null): ScoreDelta {
  if (side === 'home') return { homeDelta: 1, awayDelta: 0 };
  if (side === 'away') return { homeDelta: 0, awayDelta: 1 };
  return { homeDelta: 0, awayDelta: 0 };
}
