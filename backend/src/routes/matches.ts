import { Router } from 'express';
import {
  getMatchesByTeam,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
} from '../controllers/matches';

const router = Router();

router.get('/by-team/:teamId', getMatchesByTeam);
router.get('/:id', getMatch);
router.post('/', createMatch);
router.patch('/:id', updateMatch);
router.delete('/:id', deleteMatch);

export default router;
