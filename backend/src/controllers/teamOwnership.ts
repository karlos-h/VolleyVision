import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import {
  getOwnedTeams,
  assignOwner,
  transferOwnership,
  getTeamOwner,
} from '../services/teamOwnership.service';

/** GET /api/v1/teams/my-teams — returns all teams owned by the authenticated user. */
export async function myTeams(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const teams = await getOwnedTeams(req.user.userId);
    res.json(teams);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/teams/:id/claim — claim an unowned team. */
export async function claimTeam(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const team = await assignOwner(req.params.id, req.user.userId);
    res.json(team);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/teams/:id/transfer — transfer ownership to another user. */
export async function transferTeam(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const { newOwnerId } = req.body;
    if (!newOwnerId) throw new AppError(400, 'newOwnerId is required.');
    const team = await transferOwnership(req.params.id, req.user.userId, newOwnerId);
    res.json(team);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/teams/:id/owner — returns the owner of a team. */
export async function teamOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await getTeamOwner(req.params.id);
    res.json(owner ?? null);
  } catch (err) {
    next(err);
  }
}
