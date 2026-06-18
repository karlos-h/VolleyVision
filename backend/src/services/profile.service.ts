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
  },
) {
  const { dateOfBirth, ...rest } = data;
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...rest,
      ...(dateOfBirth !== undefined
        ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
        : {}),
    },
    select: profileSelect,
  });
}
