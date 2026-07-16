import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { checkSetCompletion } from '../lib/scoring';
import { scoringTeam } from '../lib/scoringRules';
import { applyEventRemoval } from '../services/matchState.service';
import { resolveUndoTarget, reverseAdjustmentScore } from '../lib/undo';

export async function recordEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      matchId, playerId, eventType, setNumber,
      rallyNumber, courtZone, rotationNumber, notes,
      isOpponentEvent, opponentJerseyNumber,
    } = req.body;

    const isOpponent = Boolean(isOpponentEvent);

    // ── Validation — gated on isOpponentEvent ─────────────────────────────────
    // Normal (own-player) events: identical requirement to before this change.
    // Opponent events: playerId must be absent/null; opponentJerseyNumber is optional.
    if (!matchId || !eventType || !setNumber) {
      throw new AppError(400, 'matchId, eventType, and setNumber are required.');
    }
    if (!isOpponent && !playerId) {
      throw new AppError(400, 'playerId is required for non-opponent events.');
    }
    if (isOpponent && playerId) {
      throw new AppError(400, 'playerId must not be set for opponent events.');
    }

    if (courtZone != null) {
      const zone = Number(courtZone);
      if (!Number.isInteger(zone) || zone < 1 || zone > 6) {
        throw new AppError(400, 'Court zone must be between 1 and 6.');
      }
    }

    if (rotationNumber != null) {
      const rot = Number(rotationNumber);
      if (!Number.isInteger(rot) || rot < 1 || rot > 6) {
        throw new AppError(400, 'Rotation number must be between 1 and 6.');
      }
    }

    const event = await prisma.event.create({
      data: {
        matchId,
        playerId:            isOpponent ? null : playerId,
        eventType,
        setNumber:           Number(setNumber),
        rallyNumber:         rallyNumber    != null ? Number(rallyNumber)    : null,
        courtZone:           courtZone      != null ? Number(courtZone)      : null,
        rotationNumber:      rotationNumber != null ? Number(rotationNumber) : null,
        notes:               notes || null,
        isOpponentEvent:     isOpponent,
        opponentJerseyNumber:isOpponent && opponentJerseyNumber != null
                               ? Number(opponentJerseyNumber)
                               : null,
      },
      include: { player: { select: { firstName: true, lastName: true, jerseyNumber: true } } },
    });

    const team = scoringTeam(eventType, isOpponent);
    if (team === 'home') {
      await prisma.match.update({ where: { id: matchId }, data: { homeScore: { increment: 1 } } });
      await checkSetCompletion(matchId);
    } else if (team === 'away') {
      await prisma.match.update({ where: { id: matchId }, data: { awayScore: { increment: 1 } } });
      await checkSetCompletion(matchId);
    }

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

export async function getEventsByMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { setNumber } = req.query;
    const events = await prisma.event.findMany({
      where: {
        matchId: req.params.matchId,
        ...(setNumber ? { setNumber: Number(setNumber) } : {}),
      },
      include: {
        player: { select: { firstName: true, lastName: true, jerseyNumber: true } },
      },
      orderBy: { recordedAt: 'asc' },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

// Undo the last thing that happened on a match.
//
// A manual score tap (+1 / −) does NOT create an Event — updateScore writes a
// ScoreAdjustment instead. Looking only at the Event table therefore skipped
// straight past a score tap and reversed the older stat event behind it, which
// read as "undo minuses the score again". So compare both logs and undo
// whichever actually happened last.
export async function deleteLastEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.matchId;

    const [latestEvent, latestAdjustment] = await Promise.all([
      prisma.event.findFirst({ where: { matchId }, orderBy: { recordedAt: 'desc' } }),
      prisma.scoreAdjustment.findFirst({ where: { matchId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const target = resolveUndoTarget(latestEvent, latestAdjustment);
    if (!target) throw new AppError(404, 'No events to undo.');

    if (target === 'adjustment') {
      const adjustment = latestAdjustment!;
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { homeScore: true, awayScore: true },
      });
      if (!match) throw new AppError(404, 'Match not found.');

      // A direct, symmetrical reversal — not applyEventRemoval, which is
      // event-specific. Both writes go in one transaction so the score and the
      // adjustment log can't disagree if one of them fails.
      const reversed = reverseAdjustmentScore(match, adjustment);
      await prisma.$transaction([
        prisma.match.update({
          where: { id: matchId },
          data: { homeScore: reversed.homeScore, awayScore: reversed.awayScore },
        }),
        prisma.scoreAdjustment.delete({ where: { id: adjustment.id } }),
      ]);

      // Mirrors updateScore, which checks after every manual score change:
      // reversing a negative adjustment raises the score and could carry a set.
      await checkSetCompletion(matchId);
      res.json({ deleted: adjustment.id, kind: 'adjustment' });
      return;
    }

    const event = latestEvent!;
    await prisma.event.delete({ where: { id: event.id } });
    // matchId is guaranteed here (queried by matchId); guard for the nullable type.
    if (event.matchId) await applyEventRemoval(event.matchId, event);
    res.json({ deleted: event.id, kind: 'event' });
  } catch (err) {
    next(err);
  }
}

// Delete a specific event by ID (admin correction).
export async function deleteEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) throw new AppError(404, 'Event not found.');
    await prisma.event.delete({ where: { id: event.id } });
    // Only match events affect match state; training events (matchId null) don't.
    if (event.matchId) await applyEventRemoval(event.matchId, event);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
