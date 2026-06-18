import { Router } from 'express';
import { acceptInvitationHandler, declineInvitationHandler } from '../controllers/invitation';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/:token/accept', requireAuth, acceptInvitationHandler);
router.post('/:token/decline', requireAuth, declineInvitationHandler);

export default router;
