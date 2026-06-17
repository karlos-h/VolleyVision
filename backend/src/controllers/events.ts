import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// Record a single event. This endpoint must be fast — it's called on every
// button tap courtside. Validation is intentionally minimal; the client
// enforces most rules. The DB indexes on matchId + setNumber make this query
// pattern efficient for Phase 2 aggregations.
export async function recordEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId, playerId, eventType, setNumber, rallyNumber, courtZone, notes } = req.body;

    if (!matchId || !playerId || !eventType || !setNumber) {
      throw new AppError(400, 'matchId, playerId, eventType, and setNumber are required.');
    }

    if (courtZone != null) {
      const zone = Number(courtZone);
      if (!Number.isInteger(zone) || zone < 1 || zone > 6) {
        throw new AppError(400, 'Court zone must be between 1 and 6.');
      }
    }

    const event = await prisma.event.create({
      data: {
        matchId,
        playerId,
        eventType,
        setNumber: Number(setNumber),
        rallyNumber: rallyNumber != null ? Number(rallyNumber) : null,
        courtZone: courtZone != null ? Number(courtZone) : null,
        notes: notes || null,
      },
      // Return player name so the client can confirm without a separate request
      include: { player: { select: { firstName: true, lastName: true, jerseyNumber: true } } },
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

// Get all events for a match, ordered chronologically.
// This feed powers the live ticker in the tracking screen.
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
// Courtside mistakes happen — this prevents re-entering the whole sequence.
export async function deleteLastEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const latest = await prisma.event.findFirst({
      where: { matchId: req.params.matchId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!latest) throw new AppError(404, 'No events to undo.');
    await prisma.event.delete({ where: { id: latest.id } });
    res.json({ deleted: latest.id });
  } catch (err) {
    next(err);
  }
}

// Delete a specific event by ID (admin correction).
export async function deleteEvent(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
