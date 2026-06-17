import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export async function getPlayersByTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const players = await prisma.player.findMany({
      where: { teamId: req.params.teamId },
      orderBy: { jerseyNumber: 'asc' },
    });
    res.json(players);
  } catch (err) {
    next(err);
  }
}

export async function getPlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: { team: true },
    });
    if (!player) throw new AppError(404, 'Player not found.');
    res.json(player);
  } catch (err) {
    next(err);
  }
}

export async function createPlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, jerseyNumber, position, teamId } = req.body;
    if (!firstName || !lastName || !jerseyNumber || !position || !teamId) {
      throw new AppError(400, 'All player fields are required.');
    }
    const player = await prisma.player.create({
      data: { firstName, lastName, jerseyNumber: Number(jerseyNumber), position, teamId },
    });
    res.status(201).json(player);
  } catch (err) {
    next(err);
  }
}

export async function updatePlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, jerseyNumber, position } = req.body;
    const player = await prisma.player.update({
      where: { id: req.params.id },
      data: {
        firstName,
        lastName,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
        position,
      },
    });
    res.json(player);
  } catch (err) {
    next(err);
  }
}

export async function deletePlayer(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.player.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
