import { Router } from 'express';
import { approveApprovalRequest, rejectApprovalRequest } from '../controllers/approval';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Approve/reject are gated inside the service to the head coach/owner of the
// request's team (which requireAuth alone can't express without the teamId).
router.post('/:id/approve', requireAuth, approveApprovalRequest);
router.post('/:id/reject', requireAuth, rejectApprovalRequest);

export default router;
