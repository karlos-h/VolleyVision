import { Router } from 'express';
import { myMemberships, userSearch } from '../controllers/teamMembership';
import { myInvitations } from '../controllers/invitation';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me/teams', requireAuth, myMemberships);
router.get('/me/invitations', requireAuth, myInvitations);
router.get('/search', requireAuth, userSearch);

export default router;
