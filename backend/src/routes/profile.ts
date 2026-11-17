import { Router, Request, Response, NextFunction } from 'express';
import { getProfileHandler, updateProfileHandler, acceptTermsHandler, deleteAccountHandler } from '../controllers/profile';
import { requireAuth } from '../middleware/auth';
import { termsAcceptRateLimit, accountDeleteRateLimit, loginIpRateLimit } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';
import { linkGoogleIdentity, unlinkGoogleIdentity } from '../services/socialSignIn.service';

const router = Router();

router.get('/', requireAuth, getProfileHandler);
router.patch('/', requireAuth, updateProfileHandler);
router.post('/accept-terms', requireAuth, termsAcceptRateLimit, acceptTermsHandler);
router.delete('/', requireAuth, accountDeleteRateLimit, deleteAccountHandler);

// 9.6.S3: connect Google to the signed-in account, with a fresh Google token
// and a `link` nonce issued to this same user; DELETE disconnects it (9.6.S5).
// Both need the account password: see socialSignIn.service.ts.
router.post('/identities/:provider', requireAuth, loginIpRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    if (req.params.provider !== 'google') throw new AppError(404, 'That sign-in method is not available.');
    res.json(await linkGoogleIdentity(req.user.userId, { idToken: req.body?.idToken, nonce: req.body?.nonce, password: req.body?.password }));
  } catch (err) {
    next(err);
  }
});

router.delete('/identities/:provider', requireAuth, loginIpRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    if (req.params.provider !== 'google') throw new AppError(404, 'That sign-in method is not available.');
    res.json(await unlinkGoogleIdentity(req.user.userId, req.body?.password));
  } catch (err) {
    next(err);
  }
});

export default router;
