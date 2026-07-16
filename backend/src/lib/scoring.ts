import { prisma } from './prisma';
import { completeSet, currentSetNumber } from './setOperations';
import type { MatchScoreState, SetScoreEntry } from './setOperations';

// Volleyball set win rules:
// Sets 1–4: first to 25, win by 2
// Set 5 (deciding): first to 15, win by 2
// Match: best of 5 (first to 3 sets)
function setWinTarget(setNumber: number): number {
  return setNumber >= 5 ? 15 : 25;
}

export function hasWonSet(score: number, opponentScore: number, setNumber: number): boolean {
  const target = setWinTarget(setNumber);
  return score >= target && score - opponentScore >= 2;
}

/** Reads a match into the plain state shape the pure set helpers operate on. */
export async function loadScoreState(matchId: string): Promise<MatchScoreState | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      homeScore: true,
      awayScore: true,
      homeSetsWon: true,
      awaySetsWon: true,
      setScores: true,
      status: true,
    },
  });
  if (!match) return null;

  return {
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeSetsWon: match.homeSetsWon,
    awaySetsWon: match.awaySetsWon,
    setScores: Array.isArray(match.setScores) ? (match.setScores as unknown as SetScoreEntry[]) : [],
    status: match.status,
  };
}

/**
 * Auto-completes the current set the moment a side passes the threshold with a
 * 2-point lead. The completion effects themselves live in setOperations
 * .completeSet, which the manual End Set override also calls — this function
 * only decides *whether* the threshold has been met.
 */
export async function checkSetCompletion(matchId: string): Promise<void> {
  const state = await loadScoreState(matchId);
  if (!state || state.status === 'COMPLETED') return;

  const setNumber = currentSetNumber(state);
  const homeWinsSet = hasWonSet(state.homeScore, state.awayScore, setNumber);
  const awayWinsSet = hasWonSet(state.awayScore, state.homeScore, setNumber);

  if (!homeWinsSet && !awayWinsSet) return;

  const next = completeSet(state, homeWinsSet ? 'home' : 'away');

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: next.homeScore,
      awayScore: next.awayScore,
      homeSetsWon: next.homeSetsWon,
      awaySetsWon: next.awaySetsWon,
      setScores: next.setScores,
      ...(next.status === 'COMPLETED' ? { status: 'COMPLETED' as const } : {}),
    },
  });
}
