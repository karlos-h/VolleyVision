import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendPasswordResetEmail } from '../lib/mailer';

const SALT_ROUNDS = 12;

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    profileImage: string | null;
    signupIntent: string | null;
  };
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return secret;
}

function jwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '7d';
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: jwtExpiresIn() } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, jwtSecret()) as AuthPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired token.');
  }
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const VALID_SIGNUP_INTENTS = new Set(['COACH', 'PLAYER', 'UNSURE']);

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  signupIntent: string | null = null,
): Promise<AuthResponse> {
  if (password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters.');
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new AppError(409, 'An account with that email already exists.');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const intent = signupIntent && VALID_SIGNUP_INTENTS.has(signupIntent)
    ? (signupIntent as 'COACH' | 'PLAYER' | 'UNSURE')
    : null;

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      ...(intent ? { signupIntent: intent } : {}),
    },
  });

  const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profileImage: user.profileImage,
      signupIntent: user.signupIntent ?? null,
    },
  };
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError(401, 'Invalid email or password.');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid email or password.');

  const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role };
  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profileImage: user.profileImage,
      signupIntent: user.signupIntent ?? null,
    },
  };
}

// ── Forgot password ───────────────────────────────────────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Only the hash is ever stored, so a DB leak can't be replayed as a reset link. */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a single-use reset link. Silent no-op for an unknown email: the
 * controller returns the same generic message either way, so this endpoint
 * can't be used to enumerate which addresses have accounts.
 *
 * Requesting a new link overwrites the stored hash, invalidating any previous
 * one — there is at most one live reset token per user.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  // Fire-and-forget by design: sendPasswordResetEmail never throws, and a
  // delivery failure must not change the response the caller sees.
  await sendPasswordResetEmail({ email: user.email, firstName: user.firstName }, token);
}

/**
 * Consumes a reset token and sets the new password. The token is single-use —
 * both reset columns are cleared on success, so the same link can't be replayed.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters.');
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { gt: new Date() },
    },
  });
  if (!user) {
    throw new AppError(400, 'This reset link is invalid or has expired. Request a new one.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      profileImage: true,
      signupIntent: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError(404, 'User not found.');
  return user;
}
