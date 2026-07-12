import { prisma } from '../lib/prisma';

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  profileImage: true,
  bio: true,
  phoneNumber: true,
  dateOfBirth: true,
  city: true,
  country: true,
  heightCm: true,
  weightKg: true,
  createdAt: true,
} as const;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
}

export async function updateProfile(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    phoneNumber?: string;
    dateOfBirth?: string | null;
    city?: string;
    country?: string;
    profileImage?: string;
    heightCm?: number | null;
    weightKg?: number | null;
  },
) {
  const { dateOfBirth, heightCm, weightKg, ...rest } = data;

  // Physical-profile validation: plausible adult athlete ranges.
  if (heightCm != null && (!Number.isInteger(heightCm) || heightCm < 100 || heightCm > 250)) {
    throw Object.assign(new Error('Height must be between 100 and 250 cm'), { statusCode: 400 });
  }
  if (weightKg != null && (!Number.isInteger(weightKg) || weightKg < 30 || weightKg > 200)) {
    throw Object.assign(new Error('Weight must be between 30 and 200 kg'), { statusCode: 400 });
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...rest,
      ...(dateOfBirth !== undefined
        ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
        : {}),
      ...(heightCm !== undefined ? { heightCm } : {}),
      ...(weightKg !== undefined ? { weightKg } : {}),
    },
    select: profileSelect,
  });
}
