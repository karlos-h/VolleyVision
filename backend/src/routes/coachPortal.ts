import { Router } from 'express';
import { coachDashboardHandler, coachTeamsHandler, coachStatsHandler } from '../controllers/coachPortal';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/dashboard', requireAuth, coachDashboardHandler);
router.get('/teams', requireAuth, coachTeamsHandler);
router.get('/stats', requireAuth, coachStatsHandler);

export default router;
