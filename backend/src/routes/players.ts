import { Router, Request, Response, NextFunction } from 'express';
import {
  getPlayersByTeam,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
} from '../controllers/players';
import {
  getPlayerTeams,
  addPlayerTeamLink,
  removePlayerTeamLink,
} from '../controllers/playerTeamLinks';
import { requireAuth } from '../middleware/auth';
import { hasTeamPermission, Permission } from '../services/permission.service';

// Guard for link mutations: requester must have MANAGE_TEAM on the team being linked/unlinked.
// For POST the teamId comes from req.body; for DELETE from req.params.teamId.
async function requireManageLinkedTeam(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
  const teamId = req.body.teamId ?? req.params.teamId;
  if (!teamId) { res.status(400).json({ error: 'teamId is required.' }); return; }
  const allowed = await hasTeamPermission(req.user.userId, teamId, Permission.MANAGE_TEAM);
  if (!allowed) { res.status(403).json({ error: 'You do not have permission to manage this team.' }); return; }
  next();
}

const router = Router();

// Players are always scoped to a team for roster management
router.get('/by-team/:teamId', getPlayersByTeam);
router.get('/:id', getPlayer);
router.post('/', createPlayer);
router.patch('/:id', updatePlayer);
router.delete('/:id', deletePlayer);

// Phase 7 — multi-team player links
router.get('/:playerId/teams', getPlayerTeams);
router.post('/:playerId/team-links', requireAuth, requireManageLinkedTeam, addPlayerTeamLink);
router.delete('/:playerId/team-links/:teamId', requireAuth, requireManageLinkedTeam, removePlayerTeamLink);

export default router;
