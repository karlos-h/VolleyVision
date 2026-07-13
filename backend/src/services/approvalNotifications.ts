import type { ApprovalRequest } from '@prisma/client';

/**
 * Notification hooks for the approval queue (Stabilization Pass 2).
 *
 * Deliberately no-ops for now — the spec is in-app badge/list only. These are
 * the single wiring points a future pass can connect to (e.g. the Fix 1 mailer)
 * without touching the approval service itself.
 */
export async function onApprovalRequestCreated(_request: ApprovalRequest): Promise<void> {
  // no-op — future: email the head coach that a change awaits approval
}

export async function onApprovalResolved(_request: ApprovalRequest): Promise<void> {
  // no-op — future: email the requester that their change was approved/rejected
}
