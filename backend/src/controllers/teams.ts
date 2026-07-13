import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../lib/audit';
import { defaultTeamIsPublic } from '../lib/teamVisibility';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

export async function getTeams(req: Request, res: Response, next: NextFunction) {
  try {
    // Visibility scoping (Stabilization Pass 2):
    //  - anonymous / non-admin: public teams + any team the user owns or is a member of
    //  - admin: all teams
    const userId = req.user?.userId ?? null;

    let where: Prisma.TeamWhereInput = { isPublic: true };
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role === 'ADMIN') {
        where = {};
      } else {
        where = {
          OR: [
            { isPublic: true },
            { ownerId: userId },
            { memberships: { some: { userId } } },
          ],
        };
      }
    }

    const teams = await prisma.team.findMany({
      where,
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
    const { name, division, season, isPublic } = req.body;
    if (!name || !season) throw new AppError(400, 'Team name and season are required.');
    // Visibility: explicit toggle from the form, else the env-driven default.
    const resolvedIsPublic = typeof isPublic === 'boolean' ? isPublic : defaultTeamIsPublic();
    const team = await prisma.team.create({
      data: { name, division, season, isPublic: resolvedIsPublic },
      include: { owner: { select: ownerSelect } },
    });
    if (req.user) logAudit(req.user.userId, 'CREATE_TEAM', 'team', team.id);
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, division, season, isPublic } = req.body;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: {
        name,
        division,
        season,
        ...(typeof isPublic === 'boolean' ? { isPublic } : {}),
      },
      include: { owner: { select: ownerSelect } },
    });
    if (req.user) logAudit(req.user.userId, 'UPDATE_TEAM', 'team', team.id);
    res.json(team);
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.team.delete({ where: { id: req.params.id } });
    if (req.user) logAudit(req.user.userId, 'DELETE_TEAM', 'team', req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
