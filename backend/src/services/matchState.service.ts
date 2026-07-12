import { prisma } from '../lib/prisma';
import { buildTimeline, replayTimeline } from '../lib/scoreReplay';

/**
 * Replays all remaining events AND manual score adjustments for a match and
 * writes the derived score state back to the database. Must be called after
 * any undo or delete operation so that set boundaries and match completion
 * reflect the current event log.
 *
 * Manual adjustments (ScoreAdjustment rows) are merged into the timeline by
 * timestamp, so a coach's correction survives subsequent undo/delete —
 * previously recalculation replayed events only and silently discarded them.
 */
export async function recalculateMatchState(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true },
  });
  if (!match) return;

  const [events, adjustments] = await Promise.all([
    prisma.event.findMany({
      where: { matchId },
      select: { eventType: true, isOpponentEvent: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.scoreAdjustment.findMany({
      where: { matchId },
      select: { homeDelta: true, awayDelta: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const timeline = buildTimeline(events, adjustments);
  const { homeScore, awayScore, homeSetsWon, awaySetsWon, setScores, completed } =
    replayTimeline(timeline);

  const newStatus =
    completed ? 'COMPLETED'
    : timeline.length > 0 ? 'IN_PROGRESS'
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
