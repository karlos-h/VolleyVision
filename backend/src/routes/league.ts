import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  createLeague,
  listLeagues,
  getLeague,
  createSeason,
  getSeason,
  addTeamToSeason,
  removeTeamFromSeason,
  createFixture,
  listFixtures,
  getFixture,
  linkMatch,
  unlinkMatch,
  listMyLeagues,
  getSeasonStandings,
  getSeasonRankings,
  getMatchCentre,
  getLeagueTeamProfile,
} from '../controllers/league';

const router = Router();

// ─── Leagues ─────────────────────────────────────────────────────────────────

router.get('/', requireAuth, listLeagues);
router.post('/', requireAuth, requireAdmin, createLeague);
router.get('/my', requireAuth, listMyLeagues);
router.get('/:leagueId', requireAuth, getLeague);

// ─── Seasons ──────────────────────────────────────────────────────────────────

router.post('/:leagueId/seasons', requireAuth, requireAdmin, createSeason);
router.get('/seasons/:seasonId', requireAuth, getSeason);

// ─── League Teams ─────────────────────────────────────────────────────────────

router.post('/seasons/:seasonId/teams', requireAuth, addTeamToSeason);
router.delete('/seasons/:seasonId/teams/:leagueTeamId', requireAuth, removeTeamFromSeason);

// ─── League Team Profile ──────────────────────────────────────────────────────
// Uses optionalAuth so public viewers still get the public sections;
// canViewPrivateIntel in the controller handles the private gate.

router.get('/league-teams/:leagueTeamId/profile', optionalAuth, getLeagueTeamProfile);

// ─── Standings ────────────────────────────────────────────────────────────────

router.get('/seasons/:seasonId/standings', requireAuth, getSeasonStandings);
router.get('/seasons/:seasonId/rankings', requireAuth, getSeasonRankings);
// Match centre reads are public — live scores are no more sensitive than completed results.
router.get('/seasons/:seasonId/match-centre', optionalAuth, getMatchCentre);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

router.get('/seasons/:seasonId/fixtures', requireAuth, listFixtures);
router.post('/seasons/:seasonId/fixtures', requireAuth, requireAdmin, createFixture);
router.get('/fixtures/:fixtureId', requireAuth, getFixture);

// ─── Match linking ────────────────────────────────────────────────────────────

router.patch('/fixtures/:fixtureId/link', requireAuth, linkMatch);
router.patch('/fixtures/:fixtureId/unlink', requireAuth, unlinkMatch);

export default router;
