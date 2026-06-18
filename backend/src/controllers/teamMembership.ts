import { Request, Response, NextFunction } from 'express';
import { TeamRole } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import {
  getTeamMembers,
  getUserTeams,
  addMember,
  updateMemberRole,
  removeMember,
  searchUsers,
} from '../services/teamMembership.service';

const VALID_ROLES = new Set<string>([
  'HEAD_COACH', 'ASSISTANT_COACH', 'STATISTICIAN', 'PLAYER', 'VIEWER',
]);

function parseRole(value: unknown): TeamRole {
  if (typeof value !== 'string' || !VALID_ROLES.has(value)) {
    throw new AppError(400, `role must be one of: ${[...VALID_ROLES].join(', ')}.`);
  }
  return value as TeamRole;
}

/** GET /api/v1/teams/:id/members */
export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await getTeamMembers(req.params.id);
    res.json(members);
  } catch (err) { next(err); }
}

/** POST /api/v1/teams/:id/members */
export async function createMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.body;
    if (!userId) throw new AppError(400, 'userId is required.');
    const member = await addMember(req.params.id, userId, parseRole(role));
    res.status(201).json(member);
  } catch (err) { next(err); }
}

/** PATCH /api/v1/teams/:id/members/:memberId */
export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body;
    const member = await updateMemberRole(req.params.memberId, parseRole(role));
    res.json(member);
  } catch (err) { next(err); }
}

/** DELETE /api/v1/teams/:id/members/:memberId */
export async function deleteMember(req: Request, res: Response, next: NextFunction) {
  try {
    await removeMember(req.params.memberId);
    res.status(204).send();
  } catch (err) { next(err); }
}

/** GET /api/v1/users/me/teams */
export async function myMemberships(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const teams = await getUserTeams(req.user.userId);
    res.json(teams);
  } catch (err) { next(err); }
}

/** GET /api/v1/users/search?q=... */
export async function userSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await searchUsers(q);
    res.json(users);
  } catch (err) { next(err); }
}
