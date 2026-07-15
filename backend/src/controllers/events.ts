import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { checkSetCompletion } from '../lib/scoring';
import { scoringTeam } from '../lib/scoringRules';
import { recalculateMatchState } from '../services/matchState.service';

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

// Delete the most recent event for a match (undo last entry).
export async function deleteLastEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const latest = await prisma.event.findFirst({
      where: { matchId: req.params.matchId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!latest) throw new AppError(404, 'No events to undo.');
    await prisma.event.delete({ where: { id: latest.id } });
    // matchId is guaranteed here (queried by matchId); guard for the nullable type.
    if (latest.matchId) await recalculateMatchState(latest.matchId);
    res.json({ deleted: latest.id });
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
    if (event.matchId) await recalculateMatchState(event.matchId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
