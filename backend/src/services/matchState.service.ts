import { prisma } from '../lib/prisma';
import { buildTimeline, replayTimeline } from '../lib/scoreReplay';
import { reverseEventScore } from '../lib/setOperations';

/**
 * Replays all remaining events AND manual score adjustments for a match and
 * writes the derived score state back to the database. Must be called after
 * any undo or delete operation so that set boundaries and match completion
 * reflect the current event log.
 *
 * Manual adjustments (ScoreAdjustment rows) are merged into the timeline by
 * timestamp, so a coach's correction survives subsequent undo/delete —
 * previously recalculation replayed events only and silently discarded them.
 *
 * NOTE: this is only valid while score state is fully DERIVED from the
 * timeline. A match under manual override (see applyEventRemoval) has set
 * boundaries no replay can reproduce, so callers must not use this on one.
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

/**
 * Brings match score state back in line after an event is undone or deleted.
 *
 * Normally that means a full replay. But once a coach has used a manual set
 * operation (End Set / Undo Set / Reset Match), the match's set boundaries are
 * authored rather than derived — a set force-ended at 18-12 is not something
 * replayTimeline could ever reconstruct from the events. Replaying such a match
 * would silently erase the override and its set history.
 *
 * So for an overridden match we reverse just the removed event's own point and
 * leave set state alone. The stat is still corrected and the running score
 * still moves; only the (no-longer-derivable) set boundaries are protected.
 */
export async function applyEventRemoval(
  matchId: string,
  event: { eventType: string; isOpponentEvent: boolean },
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      manualScoreOverride: true,
      homeScore: true,
      awayScore: true,
      homeSetsWon: true,
      awaySetsWon: true,
      setScores: true,
      status: true,
    },
  });
  if (!match) return;

  if (!match.manualScoreOverride) {
    await recalculateMatchState(matchId);
    return;
  }

  const next = reverseEventScore(
    {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeSetsWon: match.homeSetsWon,
      awaySetsWon: match.awaySetsWon,
      setScores: [],
      status: match.status,
    },
    event.eventType,
    event.isOpponentEvent,
  );

  await prisma.match.update({
    where: { id: matchId },
    data: { homeScore: next.homeScore, awayScore: next.awayScore },
  });
}
