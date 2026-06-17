import { PrismaClient } from '@prisma/client';

// Singleton pattern prevents connection pool exhaustion during hot reloads in
// development. In production (Node.js process stays alive) this is just a
// single instance. Pattern from Prisma's official Next.js recommendation,
// adapted for Express.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
