import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { checkSetCompletion } from '../lib/scoring';
import { logAudit } from '../lib/audit';

export async function getMatchesByTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const { opponent, status, from, to } = req.query as Record<string, string | undefined>;

    const matches = await prisma.match.findMany({
      where: {
        teamId: req.params.teamId,
        ...(opponent ? { opponent: { contains: opponent, mode: 'insensitive' } } : {}),
        ...(status   ? { status: status as any } : {}),
        ...(from || to ? {
          matchDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      include: { _count: { select: { events: true } } },
      orderBy: { matchDate: 'desc' },
    });
    res.json(matches);
  } catch (err) {
    next(err);
  }
}

export async function getMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        team: { include: { players: { orderBy: { jerseyNumber: 'asc' } } } },
        _count: { select: { events: true } },
      },
    });
    if (!match) throw new AppError(404, 'Match not found.');
    res.json(match);
  } catch (err) {
    next(err);
  }
}

export async function createMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { teamId, matchDate, opponent, competition, venue } = req.body;
    if (!teamId || !matchDate || !opponent) {
      throw new AppError(400, 'Team, date, and opponent are required.');
    }
    const match = await prisma.match.create({
      data: {
        teamId,
        matchDate: new Date(matchDate),
        opponent,
        competition,
        venue,
        status: 'SCHEDULED',
      },
    });
    if (req.user) logAudit(req.user.userId, 'CREATE_MATCH', 'match', match.id);
    res.status(201).json(match);
  } catch (err) {
    next(err);
  }
}

export async function updateMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchDate, opponent, competition, venue, status, setScores } = req.body;
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        matchDate: matchDate ? new Date(matchDate) : undefined,
        opponent,
        competition,
        venue,
        status,
        setScores,
      },
    });
    res.json(match);
  } catch (err) {
    next(err);
  }
}

export async function deleteMatch(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.match.delete({ where: { id: req.params.id } });
    if (req.user) logAudit(req.user.userId, 'DELETE_MATCH', 'match', req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Phase 4 Sprint 1 — manual score adjustment (home/away delta or absolute)
// Stabilization: also persists the change as a ScoreAdjustment delta so it
// survives recalculateMatchState after undo/delete operations.
export async function updateScore(req: Request, res: Response, next: NextFunction) {
  try {
    const { homeScore, awayScore, homeSetsWon, awaySetsWon } = req.body;

    const existing = await prisma.match.findUnique({
      where: { id: req.params.id },
      select: { homeScore: true, awayScore: true, homeSetsWon: true, awaySetsWon: true },
    });
    if (!existing) throw new AppError(404, 'Match not found.');

    // API keeps absolute-value semantics; the delta is derived for persistence.
    const homeDelta = homeScore != null ? Number(homeScore) - existing.homeScore : 0;
    const awayDelta = awayScore != null ? Number(awayScore) - existing.awayScore : 0;

    if (homeDelta !== 0 || awayDelta !== 0) {
      const currentSet = existing.homeSetsWon + existing.awaySetsWon + 1;
      await prisma.scoreAdjustment.create({
        data: { matchId: req.params.id, homeDelta, awayDelta, setNumber: currentSet },
      });
    }

    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        ...(homeScore != null ? { homeScore: Number(homeScore) } : {}),
        ...(awayScore != null ? { awayScore: Number(awayScore) } : {}),
        ...(homeSetsWon != null ? { homeSetsWon: Number(homeSetsWon) } : {}),
        ...(awaySetsWon != null ? { awaySetsWon: Number(awaySetsWon) } : {}),
      },
    });
    // Check if the manual update completed a set
    await checkSetCompletion(req.params.id);
    res.json(match);
  } catch (err) {
    next(err);
  }
}

// Phase 4 Sprint 1 — reset current set score (called at end of set)
// Stabilization: also clears that set's manual adjustments so the reset
// isn't undone by the next recalculation replaying stale deltas.
export async function resetSetScore(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.match.findUnique({
      where: { id: req.params.id },
      select: { homeSetsWon: true, awaySetsWon: true },
    });
    if (!existing) throw new AppError(404, 'Match not found.');

    const currentSet = existing.homeSetsWon + existing.awaySetsWon + 1;
    await prisma.scoreAdjustment.deleteMany({
      where: { matchId: req.params.id, setNumber: currentSet },
    });

    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: { homeScore: 0, awayScore: 0 },
    });
    res.json(match);
  } catch (err) {
    next(err);
  }
}
