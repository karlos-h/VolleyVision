import { Router } from 'express';
import {
  getMatchAnalytics,
  getPlayerAnalytics,
  getTeamAnalytics,
  getTeamTrends,
} from '../controllers/analytics';

const router = Router();

router.get('/matches/:matchId', getMatchAnalytics);
router.get('/teams/:teamId', getTeamAnalytics);
router.get('/teams/:teamId/trends', getTeamTrends);
router.get('/players/:playerId', getPlayerAnalytics);

export default router;