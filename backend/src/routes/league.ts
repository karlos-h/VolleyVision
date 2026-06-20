import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

router.get('/seasons/:seasonId/fixtures', requireAuth, listFixtures);
router.post('/seasons/:seasonId/fixtures', requireAuth, requireAdmin, createFixture);
router.get('/fixtures/:fixtureId', requireAuth, getFixture);

// ─── Match linking ────────────────────────────────────────────────────────────

router.patch('/fixtures/:fixtureId/link', requireAuth, linkMatch);
router.patch('/fixtures/:fixtureId/unlink', requireAuth, unlinkMatch);

export default router;
