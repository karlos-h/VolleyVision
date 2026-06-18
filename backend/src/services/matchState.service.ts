import { prisma } from '../lib/prisma';
import { scoringTeam } from '../lib/scoringRules';

function setWinTarget(setNumber: number): number {
  return setNumber >= 5 ? 15 : 25;
}

function hasWonSet(score: number, opponentScore: number, setNumber: number): boolean {
  const target = setWinTarget(setNumber);
  return score >= target && score - opponentScore >= 2;
}

/**
 * Replays all remaining events for a match and writes the derived score state
 * back to the database. Must be called after any undo or delete operation so
 * that set boundaries and match completion reflect the current event log.
 */
export async function recalculateMatchState(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true },
  });
  if (!match) return;

  const events = await prisma.event.findMany({
    where: { matchId },
    select: { eventType: true },
    orderBy: { recordedAt: 'asc' },
  });

  let homeScore = 0;
  let awayScore = 0;
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  const setScores: { set: number; home: number; away: number }[] = [];
  let completed = false;

  for (const event of events) {
    const team = scoringTeam(event.eventType);
    if (team === 'home') homeScore++;
    else if (team === 'away') awayScore++;
    else continue;

    const currentSet = homeSetsWon + awaySetsWon + 1;

    if (hasWonSet(homeScore, awayScore, currentSet)) {
      setScores.push({ set: currentSet, home: homeScore, away: awayScore });
      homeSetsWon++;
      homeScore = 0;
      awayScore = 0;
    } else if (hasWonSet(awayScore, homeScore, currentSet)) {
      setScores.push({ set: currentSet, home: homeScore, away: awayScore });
      awaySetsWon++;
      homeScore = 0;
      awayScore = 0;
    }

    if (homeSetsWon >= 3 || awaySetsWon >= 3) {
      completed = true;
      break;
    }
  }

  const newStatus =
    completed ? 'COMPLETED'
    : events.length > 0 ? 'IN_PROGRESS'
    : match.status === 'COMPLETED' ? 'IN_PROGRESS'
    : match.status;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      homeSetsWon,
      awaySetsWon,
      setScores,
      status: newStatus,
    },
  });
}
