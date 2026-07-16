// Team Chat — pure helpers for message validation, cursor pagination, and
// tombstone serialization. Kept out of message.service.ts so they are
// unit-testable without a database (`npm test` only runs src/lib/*.test.ts).

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 4000;
export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

// ─── Body validation ──────────────────────────────────────────────────────────

export type BodyValidation = { ok: true; body: string } | { ok: false; error: string };

/** Trim and validate a message body. The caller maps failures to AppError(400). */
export function validateMessageBody(raw: unknown): BodyValidation {
  if (typeof raw !== 'string') return { ok: false, error: 'Message body is required.' };
  const body = raw.trim();
  if (body.length === 0) return { ok: false, error: 'Message cannot be empty.' };
  if (body.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).` };
  }
  return { ok: true, body };
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function clampPageSize(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_PAGE_SIZE);
}

export interface MessageCursor {
  createdAt: Date;
  id: string;
}

// Timeline order is (createdAt, id) ascending — createdAt is server-set so it
// is monotonic per server, id breaks ties. The OR arms express a tuple
// comparison, which Prisma has no native operator for.

/** WHERE fragment for messages strictly older than the anchor. */
export function beforeCursorWhere(anchor: MessageCursor) {
  return {
    OR: [
      { createdAt: { lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, id: { lt: anchor.id } },
    ],
  };
}

/** WHERE fragment for messages strictly newer than the anchor (poll delta). */
export function afterCursorWhere(anchor: MessageCursor) {
  return {
    OR: [
      { createdAt: { gt: anchor.createdAt } },
      { createdAt: anchor.createdAt, id: { gt: anchor.id } },
    ],
  };
}

// ─── Edit / delete rules ──────────────────────────────────────────────────────

/** Only the author may edit, and deletion is terminal (deletion wins over edit). */
export function editRejection(msg: { senderId: string | null; deletedAt: Date | null }, userId: string):
  | { status: 404 | 409 | 403; error: string }
  | null {
  if (msg.deletedAt) return { status: 409, error: 'This message is no longer available.' };
  if (msg.senderId !== userId) return { status: 403, error: 'You can only edit your own messages.' };
  return null;
}

/** The author may delete their own message; moderators may delete any. */
export function canDeleteMessage(
  msg: { senderId: string | null },
  userId: string,
  isModerator: boolean,
): boolean {
  return isModerator || msg.senderId === userId;
}

// ─── Serialization ────────────────────────────────────────────────────────────

export interface SenderSummary {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

export interface SerializedMessage {
  id: string;
  channelId: string;
  senderId: string | null;
  sender: SenderSummary | null;
  body: string | null;
  attachments: unknown[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

/**
 * Deleted messages are returned as tombstones — id/sender/timestamps survive so
 * the client renders "message deleted" and ordering stays stable, but body and
 * attachments are stripped. Never omit deleted messages from a page.
 */
export function serializeMessage(msg: SerializedMessage): SerializedMessage {
  if (!msg.deletedAt) return msg;
  return {
    id: msg.id,
    channelId: msg.channelId,
    senderId: msg.senderId,
    sender: msg.sender,
    body: null,
    attachments: [],
    editedAt: null,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
  };
}
