import { Router } from 'express';
import {
  getMatchAnalytics,
  getMatchZones,
  getMatchHeatmap,
  getPlayerAnalytics,
  getPlayerHeatmap,
  getTeamAnalytics,
  getTeamTrends,
  getTeamHeatmap,
} from '../controllers/analytics';

const router = Router();

router.get('/matches/:matchId', getMatchAnalytics);
router.get('/matches/:matchId/zones', getMatchZones);
router.get('/matches/:matchId/heatmap', getMatchHeatmap);
router.get('/teams/:teamId', getTeamAnalytics);
router.get('/teams/:teamId/trends', getTeamTrends);
router.get('/teams/:teamId/heatmap', getTeamHeatmap);
router.get('/players/:playerId', getPlayerAnalytics);
router.get('/players/:playerId/heatmap', getPlayerHeatmap);

export default router;