import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { checkSetCompletion } from '../lib/scoring';

export async function getMatchesByTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const matches = await prisma.match.findMany({
      where: { teamId: req.params.teamId },
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
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Phase 4 Sprint 1 — manual score adjustment (home/away delta or absolute)
export async function updateScore(req: Request, res: Response, next: NextFunction) {
  try {
    const { homeScore, awayScore, homeSetsWon, awaySetsWon } = req.body;
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
export async function resetSetScore(req: Request, res: Response, next: NextFunction) {
  try {
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: { homeScore: 0, awayScore: 0 },
    });
    res.json(match);
  } catch (err) {
    next(err);
  }
}
