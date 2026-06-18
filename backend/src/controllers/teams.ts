import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

export async function getTeams(_req: Request, res: Response, next: NextFunction) {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: { select: { players: true, matches: true } },
        owner: { select: ownerSelect },
      },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (err) {
    next(err);
  }
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        players: { orderBy: { jerseyNumber: 'asc' } },
        matches: { orderBy: { matchDate: 'desc' }, take: 10 },
        owner: { select: ownerSelect },
      },
    });
    if (!team) throw new AppError(404, 'Team not found.');
    res.json(team);
  } catch (err) {
    next(err);
  }
}

export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, division, season } = req.body;
    if (!name || !season) throw new AppError(400, 'Team name and season are required.');
    const team = await prisma.team.create({
      data: { name, division, season },
      include: { owner: { select: ownerSelect } },
    });
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, division, season } = req.body;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: { name, division, season },
      include: { owner: { select: ownerSelect } },
    });
    res.json(team);
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.team.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
