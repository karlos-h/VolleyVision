import { Router } from 'express';
import { register, login, logout, logoutAll, me, nonce, google, socialComplete, forgotPassword, resetPassword, verifyEmail, resendVerification } from '../controllers/auth';
import { optionalAuth, requireAuth } from '../middleware/auth';
import {
  forgotPasswordGlobalRateLimit,
  forgotPasswordRateLimit,
  loginEmailRateLimit,
  loginIpRateLimit,
  registerRateLimit,
  resetPasswordRateLimit,
  verifyEmailRateLimit,
  resendVerificationRateLimit,
  resendVerificationIpRateLimit,
  socialCompleteRateLimit,
  socialNonceRateLimit,
} from '../middleware/rateLimit';

const router = Router();

// Unauthenticated + credential-checking, so both are credential-stuffing /
// spray targets. IP and email arms are separate limiters (see rateLimit.ts).
router.post('/register', registerRateLimit, register);
router.post('/login', loginIpRateLimit, loginEmailRateLimit, login);
// Behind requireAuth: the token being signed out of is the credential, and an
// already-dead one has nothing left to revoke.
router.post('/logout', requireAuth, logout);
router.post('/logout-all', requireAuth, logoutAll);
// Public by design — the emailed reset token is itself the credential. Rate
// limited on IP + email: unauthenticated, and it sends mail, so it is both an
// email-bombing vector and the obvious endpoint to hammer for enumeration.
// Per-IP/email first: the global cap must only be spent by requests that pass
// it, or one IP could drain it and block everyone's resets.
router.post('/forgot-password', forgotPasswordRateLimit, forgotPasswordGlobalRateLimit, forgotPassword);
// Brute-force defence in depth on the reset token itself (see rateLimit.ts).
router.post('/reset-password', resetPasswordRateLimit, resetPassword);
router.get('/me', requireAuth, me);
// Public: a nonce is only useful together with a Google token that echoes it.
// It costs no database work, so the limit is just against being hammered.
// optionalAuth: a link or delete nonce is issued to the signed-in user only (401 otherwise).
router.get('/nonce', socialNonceRateLimit, optionalAuth, nonce);
// Same exposure as /login and /register: unauthenticated and account-deciding.
// Per IP only: these bodies carry no email for the email arm to key on.
router.post('/google', loginIpRateLimit, google);
router.post('/social/complete', socialCompleteRateLimit, socialComplete);
// Public by design — the emailed verification token is itself the credential.
// Rate limited on IP only (defence in depth, see rateLimit.ts).
router.post('/verify-email', verifyEmailRateLimit, verifyEmail);
router.post('/resend-verification', requireAuth, resendVerificationRateLimit, resendVerificationIpRateLimit, resendVerification);

export default router;
