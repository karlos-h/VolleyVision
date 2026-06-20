import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Permission, hasTeamPermission } from '../services/permission.service';

const FORBIDDEN = { error: 'You do not have permission to perform this action.' };

// ─── Global-role guard ────────────────────────────────────────────────────────

/**
 * Requires the authenticated user to have UserRole.ADMIN.
 * Use for system-level operations (creating leagues, seasons) that are not
 * scoped to a specific team. All team-level permissions continue to use
 * hasTeamPermission — this is purely a global-role check.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
  if (req.user.role !== 'ADMIN') { res.status(403).json(FORBIDDEN); return; }
  next();
}

// ─── Team-context middleware ──────────────────────────────────────────────────

/**
 * Checks the authenticated user has `permission` on the team whose id comes
 * from `req.params[paramName]` (default: "id").
 */
export function requireTeamPermission(permission: Permission, paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
    const teamId = req.params[paramName];
    if (!teamId) { res.status(400).json({ error: 'Team ID missing from request.' }); return; }
    const allowed = await hasTeamPermission(req.user.userId, teamId, permission);
    if (!allowed) { res.status(403).json(FORBIDDEN); return; }
    next();
  };
}

// ─── Match-context middleware ─────────────────────────────────────────────────

/**
 * Looks up the match by `req.params.id`, resolves teamId, then checks permission.
 */
export function requireMatchPermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { teamId: true } });
    if (!match) { res.status(404).json({ error: 'Match not found.' }); return; }
    const allowed = await hasTeamPermission(req.user.userId, match.teamId, permission);
    if (!allowed) { res.status(403).json(FORBIDDEN); return; }
    next();
  };
}

/**
 * For POST /events — teamId resolved via req.body.matchId.
 */
export function requireEventPermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
    const matchId = req.body.matchId ?? req.params.matchId;
    if (!matchId) { res.status(400).json({ error: 'matchId is required.' }); return; }
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { teamId: true } });
    if (!match) { res.status(404).json({ error: 'Match not found.' }); return; }
    const allowed = await hasTeamPermission(req.user.userId, match.teamId, permission);
    if (!allowed) { res.status(403).json(FORBIDDEN); return; }
    next();
  };
}

/**
 * For DELETE /events/:id and DELETE /events/undo/:matchId.
 * Resolves teamId from event or undo-match param.
 */
export function requireEventDeletePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }

    let teamId: string | null = null;

    if (req.params.matchId) {
      // Undo route: /events/undo/:matchId
      const match = await prisma.match.findUnique({
        where: { id: req.params.matchId },
        select: { teamId: true },
      });
      teamId = match?.teamId ?? null;
    } else if (req.params.id) {
      // Delete specific event
      const event = await prisma.event.findUnique({
        where: { id: req.params.id },
        include: { match: { select: { teamId: true } } },
      });
      teamId = event?.match.teamId ?? null;
    }

    if (!teamId) { res.status(404).json({ error: 'Resource not found.' }); return; }
    const allowed = await hasTeamPermission(req.user.userId, teamId, permission);
    if (!allowed) { res.status(403).json(FORBIDDEN); return; }
    next();
  };
}
