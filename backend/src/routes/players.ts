import { Router } from 'express';
import {
  getPlayersByTeam,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
} from '../controllers/players';

const router = Router();

// Players are always scoped to a team for roster management
router.get('/by-team/:teamId', getPlayersByTeam);
router.get('/:id', getPlayer);
router.post('/', createPlayer);
router.patch('/:id', updatePlayer);
router.delete('/:id', deletePlayer);

export default router;
