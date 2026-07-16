import { Router } from 'express';
import {
  recordEvent,
  getEventsByMatch,
  deleteLastEvent,
  deleteEvent,
} from '../controllers/events';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireEventPermission, requireEventDeletePermission } from '../middleware/permissions';
import { visibleByMatchParam } from '../middleware/visibility';
import { Permission } from '../services/permission.service';

const router = Router();

router.post('/', requireAuth, requireEventPermission(Permission.TRACK_MATCH), recordEvent);
router.get('/by-match/:matchId', optionalAuth, visibleByMatchParam('matchId'), getEventsByMatch);
router.delete('/undo/:matchId', requireAuth, requireEventDeletePermission(Permission.TRACK_MATCH), deleteLastEvent);
router.delete('/:id', requireAuth, requireEventDeletePermission(Permission.TRACK_MATCH), deleteEvent);

export default router;
