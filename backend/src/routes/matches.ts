import { Router } from 'express';
import {
  getMatchesByTeam,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
  updateScore,
  resetSetScore,
} from '../controllers/matches';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireMatchPermission } from '../middleware/permissions';
import { visibleByTeamParam, visibleByMatchParam } from '../middleware/visibility';
import { Permission } from '../services/permission.service';

// For POST /matches we need teamId from the body to check permissions.
// We do that inline since the router doesn't have a natural param for it.
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { hasTeamPermission } from '../services/permission.service';

async function requireCreateMatch(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
  const { teamId } = req.body;
  if (!teamId) { next(); return; } // body validation is the controller's job
  const allowed = await hasTeamPermission(req.user.userId, teamId, Permission.CREATE_MATCH);
  if (!allowed) { res.status(403).json({ error: 'You do not have permission to perform this action.' }); return; }
  next();
}

const router = Router();

router.get('/by-team/:teamId', optionalAuth, visibleByTeamParam('teamId'), getMatchesByTeam);
router.get('/:id', optionalAuth, visibleByMatchParam('id'), getMatch);
router.post('/', requireAuth, requireCreateMatch, createMatch);
router.patch('/:id', requireAuth, requireMatchPermission(Permission.EDIT_MATCH), updateMatch);
router.patch('/:id/score', requireAuth, requireMatchPermission(Permission.TRACK_MATCH), updateScore);
router.post('/:id/score/reset', requireAuth, requireMatchPermission(Permission.TRACK_MATCH), resetSetScore);
router.delete('/:id', requireAuth, requireMatchPermission(Permission.DELETE_MATCH), deleteMatch);

export default router;
