import { Router } from 'express';
import { acceptInvitationHandler, declineInvitationHandler, redeemInvitationHandler } from '../controllers/invitation';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Redeem by join code (email flow). requireAuth: the user must be logged in so
// we know who joins — the RedeemInvitationPage handles login/register first.
router.post('/redeem', requireAuth, redeemInvitationHandler);
router.post('/:token/accept', requireAuth, acceptInvitationHandler);
router.post('/:token/decline', requireAuth, declineInvitationHandler);

export default router;
