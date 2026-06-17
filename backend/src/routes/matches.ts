import { Router } from 'express';
import {
  getMatchesByTeam,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
  updateScore,
  resetSetScore,
} from '../controllers/matches';

const router = Router();

router.get('/by-team/:teamId', getMatchesByTeam);
router.get('/:id', getMatch);
router.post('/', createMatch);
router.patch('/:id', updateMatch);
router.patch('/:id/score', updateScore);
router.post('/:id/score/reset', resetSetScore);
router.delete('/:id', deleteMatch);

export default router;
