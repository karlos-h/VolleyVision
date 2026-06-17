import { Router } from 'express';
import {
  recordEvent,
  getEventsByMatch,
  deleteLastEvent,
  deleteEvent,
} from '../controllers/events';

const router = Router();

router.post('/', recordEvent);
router.get('/by-match/:matchId', getEventsByMatch);
router.delete('/undo/:matchId', deleteLastEvent);   // undo last tap
router.delete('/:id', deleteEvent);                  // delete specific event

export default router;
