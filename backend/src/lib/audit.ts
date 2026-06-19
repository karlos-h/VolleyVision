import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Fire-and-forget audit log entry. Never throws — failures are silently swallowed. */
export function logAudit(
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  meta?: Record<string, unknown>,
): void {
  prisma.auditLog
    .create({
      data: {
        userId, action, resource, resourceId,
        meta: meta !== undefined ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    .catch(() => {/* intentionally ignored */});
}
