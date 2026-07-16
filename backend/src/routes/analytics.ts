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
  getPlayerDevelopmentReport,
  getSeasonIntelligence,
  getTeamTrainingRecommendations,
  postTeamAssistantQuestion,
  getOpponentScoutingReport,
} from '../controllers/analytics';
import { optionalAuth } from '../middleware/auth';
import { visibleByTeamParam, visibleByMatchParam, visibleByPlayerParam } from '../middleware/visibility';

const router = Router();

// Analytics reads are public for public teams; private teams are hidden from
// non-members. optionalAuth populates req.user when a token is present so the
// per-route visibility guard can tell "no token" from "wrong user".
router.use(optionalAuth);

const mVis = visibleByMatchParam('matchId');
const tVis = visibleByTeamParam('teamId');
const pVis = visibleByPlayerParam('playerId');

router.get('/matches/:matchId/opponent-report', mVis, getOpponentScoutingReport);
router.get('/matches/:matchId', mVis, getMatchAnalytics);
router.get('/matches/:matchId/advanced', mVis, getMatchAdvanced);
router.get('/matches/:matchId/report', mVis, getMatchReport);
router.get('/matches/:matchId/report/narrative', mVis, getMatchReportNarrative);
router.get('/matches/:matchId/zones', mVis, getMatchZones);
router.get('/matches/:matchId/heatmap', mVis, getMatchHeatmap);
router.get('/matches/:matchId/heatmap/zones', mVis, getMatchZoneDetail);
router.get('/matches/:matchId/momentum', mVis, getMatchMomentum);
router.get('/matches/:matchId/rotations', mVis, getMatchRotations);
router.get('/teams/:teamId', tVis, getTeamAnalytics);
router.get('/teams/:teamId/trends', tVis, getTeamTrends);
router.get('/teams/:teamId/advanced', tVis, getTeamAdvanced);
router.get('/teams/:teamId/heatmap', tVis, getTeamHeatmap);
router.get('/teams/:teamId/heatmap/zones', tVis, getTeamZoneDetail);
router.get('/teams/:teamId/rotations', tVis, getTeamRotations);
router.get('/teams/:teamId/recommendations', tVis, getTeamCoachingRecommendations);
router.get('/teams/:teamId/season-intelligence', tVis, getSeasonIntelligence);
router.get('/teams/:teamId/training-recommendations', tVis, getTeamTrainingRecommendations);
router.post('/teams/:teamId/ask', tVis, postTeamAssistantQuestion);
router.get('/players/:playerId', pVis, getPlayerAnalytics);
router.get('/players/:playerId/heatmap', pVis, getPlayerHeatmap);
router.get('/players/:playerId/heatmap/zones', pVis, getPlayerZoneDetail);
router.get('/players/:playerId/development', pVis, getPlayerDevelopmentReport);

export default router;