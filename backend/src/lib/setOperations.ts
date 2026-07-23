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

/**
 * Whichever side currently leads the running score, or null if it's tied.
 *
 * No live caller today — kept for the commented-out endSet controller in
 * controllers/matches.ts, which uses it to pick the set's winner.
 */
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
