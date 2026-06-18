import { Router } from 'express';
import {
  playerDashboardHandler,
  playerStatsHandler,
  playerTeamsHandler,
  linkPlayerHandler,
  unlinkPlayerHandler,
} from '../controllers/playerPortal';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/dashboard', requireAuth, playerDashboardHandler);
router.get('/stats', requireAuth, playerStatsHandler);
router.get('/teams', requireAuth, playerTeamsHandler);
router.post('/link', requireAuth, linkPlayerHandler);
router.delete('/link/:playerId', requireAuth, unlinkPlayerHandler);

export default router;
