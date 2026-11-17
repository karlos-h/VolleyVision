// 9.6.S3: what a verified Google sign-in turns into: a session for a known
// identity, an auto-link to a same-email account (only when safe, see
// lib/socialLink.ts), or a first-time sign-up. Token checks live in
// socialAuth.service.ts; nothing here trusts a claim that file didn't verify.
import { type JWTVerifyGetKey } from 'jose';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { signSignupToken, verifySignupToken } from '../lib/socialTokens';
import { canAutoLink, googleIsAuthoritative } from '../lib/socialLink';
import { normalizeEmail } from '../lib/email';
import { logAudit } from '../lib/audit';
import { sendSignInMethodEmail } from '../lib/mailer';
import { AuthResponse, createAccount, getCurrentUser, sessionFor, verifyPassword } from './auth.service';
import { verifyGoogleSignIn } from './socialAuth.service';

type Deps = { keys?: JWTVerifyGetKey; audiences?: string[] };

export type SocialSignInResult =
  | AuthResponse
  | { needsSignup: true; signupToken: string; suggested: { firstName: string; lastName: string; email: string } };

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true, role: true, profileImage: true, signupIntent: true,
  emailVerifiedAt: true, termsAcceptedAt: true, termsVersion: true, tokenVersion: true,
} as const;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return secret;
}

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const linkRequired = () =>
  new AppError(409, 'An account with this email exists. Sign in with your password, then connect Google in Profile.', 'LINK_REQUIRED');

/** POST /auth/google. Decided in this order: known identity, same-email account, new person. */
export async function signInWithGoogle(input: { idToken: unknown; nonce: unknown }, deps: Deps = {}): Promise<SocialSignInResult> {
  const identity = await verifyGoogleSignIn({ ...input, purpose: 'signin' }, deps);

  // 1. We know this Google account: sign in. Keyed on Google's id, never email.
  const known = await prisma.userIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: identity.subject } },
    select: { id: true, user: { select: USER_SELECT } },
  });
  if (known) {
    await prisma.userIdentity.update({
      where: { id: known.id },
      data: { lastUsedAt: new Date(), email: identity.email, emailVerified: identity.emailVerified },
      select: { id: true },
    });
    logAudit(known.user.id, 'SOCIAL_SIGN_IN', 'user', known.user.id, { provider: 'GOOGLE' });
    return sessionFor(known.user);
  }

  if (!identity.email) throw new AppError(400, 'Google did not share an email address for that account, so it cannot be used to sign in.');

  // 2. No identity yet, but an account has this email.
  const existing = await prisma.user.findUnique({ where: { email: normalizeEmail(identity.email) }, select: USER_SELECT });
  if (existing) {
    if (!canAutoLink(identity, existing)) throw linkRequired();
    try {
      await prisma.userIdentity.create({
        data: { userId: existing.id, provider: 'GOOGLE', providerSubject: identity.subject, email: identity.email, emailVerified: true, lastUsedAt: new Date() },
        select: { id: true },
      });
    } catch (err) {
      // The account already has a different Google identity (or lost a race).
      if (isUniqueViolation(err)) throw linkRequired();
      throw err;
    }
    logAudit(existing.id, 'IDENTITY_LINKED', 'user', existing.id, { provider: 'GOOGLE', how: 'auto' });
    logAudit(existing.id, 'SOCIAL_SIGN_IN', 'user', existing.id, { provider: 'GOOGLE' });
    await notify(existing.email, existing.firstName, 'connected');
    return sessionFor(existing);
  }

  // 3. A new person: no account yet. They still have to accept the Terms and
  // confirm they are 13+, so hand back what Google vouched for in a signed token.
  // The new account starts verified only when Google is the authority for the
  // address (gmail.com or Workspace). A Google account can sit on top of any
  // mailbox, including one its holder no longer owns: for those we send our
  // own verification email, like a password sign-up.
  return {
    needsSignup: true,
    signupToken: signSignupToken(jwtSecret(), {
      provider: 'GOOGLE', subject: identity.subject, email: identity.email, emailVerified: identity.emailVerified && googleIsAuthoritative(identity),
      givenName: identity.givenName, familyName: identity.familyName,
    }),
    suggested: { firstName: identity.givenName ?? '', lastName: identity.familyName ?? '', email: identity.email },
  };
}

const MAX_NAME_LENGTH = 100;
const cleanName = (v: unknown): string | null => (typeof v === 'string' && v.trim() && v.trim().length <= MAX_NAME_LENGTH ? v.trim() : null);

/** POST /auth/social/complete: the sign-up form after a first Google sign-in. */
export async function completeSocialSignup(input: {
  signupToken?: unknown; acceptTerms?: unknown; firstName?: unknown; lastName?: unknown; signupIntent?: unknown;
}): Promise<AuthResponse> {
  const token = verifySignupToken(input.signupToken, jwtSecret());
  if (!token.ok) throw new AppError(401, 'That sign-up has expired. Start again with Sign in with Google.', 'SIGNUP_TOKEN_REJECTED');
  if (input.acceptTerms !== true) throw new AppError(400, "Please confirm you're 13 or older and accept the Terms.");
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  if (!firstName || !lastName) throw new AppError(400, 'First name and last name are required.');
  const claims = token.value;

  let result: AuthResponse;
  try {
    result = await createAccount({
      email: claims.email,
      passwordHash: null,
      firstName,
      lastName,
      signupIntent: typeof input.signupIntent === 'string' ? input.signupIntent : null,
      emailVerified: claims.emailVerified,
      identity: { provider: claims.provider, providerSubject: claims.subject, email: claims.email, emailVerified: claims.emailVerified },
    });
  } catch (err) {
    // The token was already used, or the email was taken while the form was open.
    if (isUniqueViolation(err)) throw new AppError(409, 'An account for that sign-in already exists. Sign in instead.', 'ACCOUNT_EXISTS');
    throw err;
  }
  logAudit(result.user.id, 'IDENTITY_CREATED', 'user', result.user.id, { provider: claims.provider });
  return result;
}

/** POST /profile/identities/google: connect Google to the signed-in account. No unlink this phase. */
export async function linkGoogleIdentity(
  userId: string,
  input: { idToken: unknown; nonce: unknown; password?: unknown },
  deps: Deps = {},
): Promise<{ linked: true; signInMethods: string[] }> {
  // Adding a way to sign in is as sensitive as changing the password, and it
  // outlives a password reset. So a session alone is not enough: an account
  // with a password must give it (a stolen session token cannot). 403, not
  // 401, like delete-account: the app signs out on any 401.
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!account) throw new AppError(401, 'Your session has ended. Sign in again.');
  if (account.passwordHash !== null) {
    if (typeof input.password !== 'string' || !input.password) throw new AppError(400, 'Enter your password to connect Google.');
    if (!(await verifyPassword(input.password, account.passwordHash))) throw new AppError(403, 'That password is not right.', 'WRONG_PASSWORD');
  }

  const identity = await verifyGoogleSignIn({ ...input, purpose: 'link', userId }, deps);

  const owner = await prisma.userIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: identity.subject } },
    select: { userId: true },
  });
  if (owner && owner.userId !== userId) {
    throw new AppError(409, 'That Google account is already connected to another VolleyVision account.', 'IDENTITY_IN_USE');
  }
  if (!owner) {
    try {
      await prisma.userIdentity.create({
        data: { userId, provider: 'GOOGLE', providerSubject: identity.subject, email: identity.email, emailVerified: identity.emailVerified },
        select: { id: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError(409, 'This account is already connected to a Google account.', 'IDENTITY_EXISTS');
      throw err;
    }
    logAudit(userId, 'IDENTITY_LINKED', 'user', userId, { provider: 'GOOGLE', how: 'profile' });
  }
  const me = await getCurrentUser(userId);
  if (!owner) await notify(me.email, me.firstName, 'connected');
  return { linked: true, signInMethods: me.signInMethods };
}

/**
 * DELETE /profile/identities/google (9.6.S5): disconnect Google. Only for an
 * account that has a password, and only with that password: otherwise removing
 * Google would lock the owner out, or let a stolen session cut them off.
 */
export async function unlinkGoogleIdentity(userId: string, password: unknown): Promise<{ linked: false; signInMethods: string[] }> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, email: true, firstName: true } });
  if (!account) throw new AppError(401, 'Your session has ended. Sign in again.');
  if (account.passwordHash === null) {
    throw new AppError(409, 'Set a password first (use Forgot password on the sign-in page), so you can still sign in after removing Google.', 'PASSWORD_REQUIRED');
  }
  if (typeof password !== 'string' || !password) throw new AppError(400, 'Enter your password to remove Google.');
  if (!(await verifyPassword(password, account.passwordHash))) throw new AppError(403, 'That password is not right.', 'WRONG_PASSWORD');

  const removed = await prisma.userIdentity.deleteMany({ where: { userId, provider: 'GOOGLE' } });
  if (removed.count === 0) throw new AppError(404, 'Google is not connected to this account.');
  logAudit(userId, 'IDENTITY_UNLINKED', 'user', userId, { provider: 'GOOGLE' });
  await notify(account.email, account.firstName, 'removed');
  const me = await getCurrentUser(userId);
  return { linked: false, signInMethods: me.signInMethods };
}

/**
 * Delete-account confirmation for an account with no password (9.6.S5): a
 * fresh Google sign-in, with a `delete` nonce issued to this user, for a
 * Google account that is already connected to it. Throws unless all hold.
 */
export async function confirmDeletionWithGoogle(userId: string, input: { idToken: unknown; nonce: unknown }, deps: Deps = {}): Promise<void> {
  const identity = await verifyGoogleSignIn({ ...input, purpose: 'delete', userId, maxTokenAgeSeconds: 5 * 60 }, deps);
  const mine = await prisma.userIdentity.findFirst({ where: { userId, provider: 'GOOGLE', providerSubject: identity.subject }, select: { id: true } });
  // 403, not 401: the app signs out on any 401, and this is "wrong Google account".
  if (!mine) throw new AppError(403, 'That Google account is not the one connected to this VolleyVision account.', 'WRONG_GOOGLE_ACCOUNT');
}

/** Best effort: a sign-in change never fails because the email did not send. */
async function notify(email: string, firstName: string, change: 'connected' | 'removed'): Promise<void> {
  await sendSignInMethodEmail(email, firstName, change).catch(() => false);
}
