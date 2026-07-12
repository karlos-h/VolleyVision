import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

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
