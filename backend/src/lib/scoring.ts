import { prisma } from './prisma';

// Volleyball set win rules:
// Sets 1–4: first to 25, win by 2
// Set 5 (deciding): first to 15, win by 2
// Match: best of 5 (first to 3 sets)
function setWinTarget(setNumber: number): number {
  return setNumber >= 5 ? 15 : 25;
}

function hasWonSet(score: number, opponentScore: number, setNumber: number): boolean {
  const target = setWinTarget(setNumber);
  return score >= target && score - opponentScore >= 2;
}

export async function checkSetCompletion(matchId: string): Promise<void> {
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

  if (!match || match.status === 'COMPLETED') return;

  const { homeScore, awayScore, homeSetsWon, awaySetsWon } = match;
  const currentSet = homeSetsWon + awaySetsWon + 1;

  const homeWinsSet = hasWonSet(homeScore, awayScore, currentSet);
  const awayWinsSet = hasWonSet(awayScore, homeScore, currentSet);

  if (!homeWinsSet && !awayWinsSet) return;

  const existingScores = Array.isArray(match.setScores) ? (match.setScores as { set: number; home: number; away: number }[]) : [];
  const updatedSetScores = [
    ...existingScores.filter((s) => s.set !== currentSet),
    { set: currentSet, home: homeScore, away: awayScore },
  ].sort((a, b) => a.set - b.set);

  const newHomeSets = homeSetsWon + (homeWinsSet ? 1 : 0);
  const newAwaySets = awaySetsWon + (awayWinsSet ? 1 : 0);
  const matchWon = newHomeSets >= 3 || newAwaySets >= 3;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: 0,
      awayScore: 0,
      homeSetsWon: newHomeSets,
      awaySetsWon: newAwaySets,
      setScores: updatedSetScores,
      ...(matchWon ? { status: 'COMPLETED' } : {}),
    },
  });
}
