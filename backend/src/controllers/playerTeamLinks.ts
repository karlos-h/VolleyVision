import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// GET /players/:playerId/teams
// Returns the player's home team plus all additional linked teams.
export async function getPlayerTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        team: { select: { id: true, name: true, division: true, season: true } },
        teamLinks: {
          select: {
            id: true,
            createdAt: true,
            team: { select: { id: true, name: true, division: true, season: true } },
          },
        },
      },
    });
    if (!player) throw new AppError(404, 'Player not found.');

    res.json({
      homeTeam: player.team,
      linkedTeams: player.teamLinks.map((l) => ({ linkId: l.id, team: l.team, linkedAt: l.createdAt })),
    });
  } catch (err) { next(err); }
}

// POST /players/:playerId/team-links
// Body: { teamId }
// Requires the caller to have MANAGE_TEAM on the target team (checked upstream via middleware).
export async function addPlayerTeamLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { playerId } = req.params;
    const { teamId } = req.body as { teamId?: string };
    if (!teamId) throw new AppError(400, 'teamId is required.');

    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!player) throw new AppError(404, 'Player not found.');

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new AppError(404, 'Team not found.');

    const link = await prisma.playerTeamLink.create({
      data: { playerId, teamId },
      include: { team: { select: { id: true, name: true, division: true, season: true } } },
    });
    res.status(201).json(link);
  } catch (err: any) {
    // Unique constraint violation — link already exists
    if (err?.code === 'P2002') {
      next(new AppError(409, 'Player is already linked to this team.'));
    } else {
      next(err);
    }
  }
}

// DELETE /players/:playerId/team-links/:teamId
export async function removePlayerTeamLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { playerId, teamId } = req.params;

    const link = await prisma.playerTeamLink.findUnique({
      where: { playerId_teamId: { playerId, teamId } },
    });
    if (!link) throw new AppError(404, 'Team link not found.');

    await prisma.playerTeamLink.delete({ where: { playerId_teamId: { playerId, teamId } } });
    res.status(204).send();
  } catch (err) { next(err); }
}
