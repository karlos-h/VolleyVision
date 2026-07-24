import { Router } from 'express';
import { register, login, logout, me, forgotPassword, resetPassword } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
// Public by design — the emailed reset token is itself the credential.
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', requireAuth, me);

export default router;
