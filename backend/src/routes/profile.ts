import { Router } from 'express';
import { getProfileHandler, updateProfileHandler } from '../controllers/profile';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getProfileHandler);
router.patch('/', requireAuth, updateProfileHandler);

export default router;
