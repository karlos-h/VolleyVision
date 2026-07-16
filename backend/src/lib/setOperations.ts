// Pure set-boundary operations, shared by the automatic scoring path
// (lib/scoring.ts), the manual override endpoints (controllers/matches.ts),
// and their tests.
//
// Kept free of Prisma — like lib/scoreReplay.ts — so `npm test` can exercise
// every rule without a database. The controllers are thin: read the row, apply
// one of these functions, write the result back.

import { scoringTeam } from './scoringRules';

// A type alias rather than an interface on purpose: Prisma's Json input types
// require an implicit index signature, which interfaces don't get. This lets
// setScores be written straight to the Json column without a cast.
export type SetScoreEntry = {
  set: number;
  home: number;
  away: number;
};

export interface MatchScoreState {
  homeScore: number;
  awayScore: number;
  homeSetsWon: number;
  awaySetsWon: number;
  setScores: SetScoreEntry[];
  status: string;
}

export type Side = 'home' | 'away';

/** Best-of-5: the first side to take 3 sets wins the match. */
export const SETS_TO_WIN_MATCH = 3;

/** The set currently being played (1-based). */
export function currentSetNumber(state: Pick<MatchScoreState, 'homeSetsWon' | 'awaySetsWon'>): number {
  return state.homeSetsWon + state.awaySetsWon + 1;
}

/** Whichever side currently leads the running score, or null if it's tied. */
export function leadingSide(state: Pick<MatchScoreState, 'homeScore' | 'awayScore'>): Side | null {
  if (state.homeScore > state.awayScore) return 'home';
  if (state.awayScore > state.homeScore) return 'away';
  return null;
}

/**
 * The completion effects for a set won by `winner`: bank the running score into
 * setScores, award the set, zero the running score for the next one, and
 * complete the match once a side reaches 3.
 *
 * Both the automatic threshold path and the manual End Set override call this,
 * so the two can never drift apart. It deliberately does NOT decide *whether*
 * the set is over — callers do that (threshold vs. coach's judgement).
 */
export function completeSet(state: MatchScoreState, winner: Side): MatchScoreState {
  const setNumber = currentSetNumber(state);

  const setScores = [
    ...state.setScores.filter((s) => s.set !== setNumber),
    { set: setNumber, home: state.homeScore, away: state.awayScore },
  ].sort((a, b) => a.set - b.set);

  const homeSetsWon = state.homeSetsWon + (winner === 'home' ? 1 : 0);
  const awaySetsWon = state.awaySetsWon + (winner === 'away' ? 1 : 0);
  const matchWon = homeSetsWon >= SETS_TO_WIN_MATCH || awaySetsWon >= SETS_TO_WIN_MATCH;

  return {
    homeScore: 0,
    awayScore: 0,
    homeSetsWon,
    awaySetsWon,
    setScores,
    status: matchWon ? 'COMPLETED' : state.status,
  };
}

/**
 * Undo the most recent completed set: restore its score so play resumes
 * mid-set, take the set back off whoever won it, and un-complete the match if
 * that set is what finished it.
 *
 * Returns null when there is no set to undo, so callers can no-op rather than
 * writing a pointless update.
 */
export function undoLastSet(state: MatchScoreState): MatchScoreState | null {
  if (state.setScores.length === 0) return null;

  const ordered = [...state.setScores].sort((a, b) => a.set - b.set);
  const last = ordered[ordered.length - 1];

  // A tied entry can't exist (neither the threshold nor End Set can produce
  // one), but if some legacy row has one there's no winner to give the set
  // back to — restore the score and leave the set counts alone.
  const winner = leadingSide({ homeScore: last.home, awayScore: last.away });

  const homeSetsWon = Math.max(0, state.homeSetsWon - (winner === 'home' ? 1 : 0));
  const awaySetsWon = Math.max(0, state.awaySetsWon - (winner === 'away' ? 1 : 0));
  const stillWon = homeSetsWon >= SETS_TO_WIN_MATCH || awaySetsWon >= SETS_TO_WIN_MATCH;

  return {
    homeScore: last.home,
    awayScore: last.away,
    homeSetsWon,
    awaySetsWon,
    setScores: ordered.slice(0, -1),
    // Only un-complete if the popped set is what won it — a match sitting at
    // 3-1 that loses its 4th (dead-rubber) set entry stays COMPLETED.
    status: state.status === 'COMPLETED' && !stillWon ? 'IN_PROGRESS' : state.status,
  };
}

/** Zero the entire match: no sets won, no history, no running score. */
export function resetMatchScore(state: MatchScoreState): MatchScoreState {
  return {
    homeScore: 0,
    awayScore: 0,
    homeSetsWon: 0,
    awaySetsWon: 0,
    setScores: [],
    status: state.status === 'COMPLETED' ? 'IN_PROGRESS' : state.status,
  };
}

/**
 * Reverse a single event's contribution to the running score, clamped at zero.
 *
 * This is the fallback for removing an event from a match under manual
 * override, where replaying the timeline would discard the override. Non-scoring
 * events (digs, passes, assists) leave the score untouched.
 */
export function reverseEventScore(
  state: MatchScoreState,
  eventType: string,
  isOpponentEvent: boolean,
): MatchScoreState {
  const team = scoringTeam(eventType, isOpponentEvent);
  if (team === 'home') return { ...state, homeScore: Math.max(0, state.homeScore - 1) };
  if (team === 'away') return { ...state, awayScore: Math.max(0, state.awayScore - 1) };
  return state;
}
