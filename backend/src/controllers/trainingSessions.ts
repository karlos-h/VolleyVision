import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../lib/audit';
import { createTrainingSession, listTrainingSessions } from '../services/trainingSession.service';

/** POST /api/v1/training-sessions — staff only (TRACK_MATCH), gated in the route. */
export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { teamId, sessionDate, durationMinutes, location, notes } = req.body;
    if (!teamId || !sessionDate) throw new AppError(400, 'teamId and sessionDate are required.');

    const parsedDate = new Date(sessionDate);
    if (Number.isNaN(parsedDate.getTime())) throw new AppError(400, 'sessionDate is not a valid date.');

    const session = await createTrainingSession({
      teamId,
      createdByUserId: req.user!.userId,
      sessionDate: parsedDate,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : null,
      location: location ?? null,
      notes: notes ?? null,
    });
    logAudit(req.user!.userId, 'CREATE_TRAINING_SESSION', 'training_session', session.id);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/training-sessions/by-team/:teamId — staff only (TRACK_MATCH). */
export async function listSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await listTrainingSessions(req.params.teamId);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
}
