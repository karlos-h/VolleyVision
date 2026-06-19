import { Router } from 'express';
import {
  getMatchAnalytics,
  getMatchAdvanced,
  getMatchReport,
  getMatchReportNarrative,
  getMatchZones,
  getMatchHeatmap,
  getMatchZoneDetail,
  getMatchMomentum,
  getMatchRotations,
  getPlayerAnalytics,
  getPlayerHeatmap,
  getPlayerZoneDetail,
  getTeamAnalytics,
  getTeamAdvanced,
  getTeamTrends,
  getTeamHeatmap,
  getTeamZoneDetail,
  getTeamRotations,
  getTeamCoachingRecommendations,
} from '../controllers/analytics';

const router = Router();

router.get('/matches/:matchId', getMatchAnalytics);
router.get('/matches/:matchId/advanced', getMatchAdvanced);
router.get('/matches/:matchId/report', getMatchReport);
router.get('/matches/:matchId/report/narrative', getMatchReportNarrative);
router.get('/matches/:matchId/zones', getMatchZones);
router.get('/matches/:matchId/heatmap', getMatchHeatmap);
router.get('/matches/:matchId/heatmap/zones', getMatchZoneDetail);
router.get('/matches/:matchId/momentum', getMatchMomentum);
router.get('/matches/:matchId/rotations', getMatchRotations);
router.get('/teams/:teamId', getTeamAnalytics);
router.get('/teams/:teamId/trends', getTeamTrends);
router.get('/teams/:teamId/advanced', getTeamAdvanced);
router.get('/teams/:teamId/heatmap', getTeamHeatmap);
router.get('/teams/:teamId/heatmap/zones', getTeamZoneDetail);
router.get('/teams/:teamId/rotations', getTeamRotations);
router.get('/teams/:teamId/recommendations', getTeamCoachingRecommendations);
router.get('/players/:playerId', getPlayerAnalytics);
router.get('/players/:playerId/heatmap', getPlayerHeatmap);
router.get('/players/:playerId/heatmap/zones', getPlayerZoneDetail);

export default router;