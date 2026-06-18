import { Router } from 'express';
import {
  getMatchAnalytics,
  getMatchAdvanced,
  getMatchZones,
  getMatchHeatmap,
  getMatchMomentum,
  getMatchRotations,
  getPlayerAnalytics,
  getPlayerHeatmap,
  getTeamAnalytics,
  getTeamAdvanced,
  getTeamTrends,
  getTeamHeatmap,
  getTeamRotations,
} from '../controllers/analytics';

const router = Router();

router.get('/matches/:matchId', getMatchAnalytics);
router.get('/matches/:matchId/advanced', getMatchAdvanced);
router.get('/matches/:matchId/zones', getMatchZones);
router.get('/matches/:matchId/heatmap', getMatchHeatmap);
router.get('/matches/:matchId/momentum', getMatchMomentum);
router.get('/matches/:matchId/rotations', getMatchRotations);
router.get('/teams/:teamId', getTeamAnalytics);
router.get('/teams/:teamId/trends', getTeamTrends);
router.get('/teams/:teamId/advanced', getTeamAdvanced);
router.get('/teams/:teamId/heatmap', getTeamHeatmap);
router.get('/teams/:teamId/rotations', getTeamRotations);
router.get('/players/:playerId', getPlayerAnalytics);
router.get('/players/:playerId/heatmap', getPlayerHeatmap);

export default router;