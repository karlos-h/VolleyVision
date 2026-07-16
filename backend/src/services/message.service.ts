// Team Chat — message read/write service. Permission gating happens in the
// route middleware (requireChannelPermission) and controller; this service
// enforces the author-level rules (edit own, delete own-or-moderated) and the
// soft-delete/tombstone contract.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  afterCursorWhere,
  beforeCursorWhere,
  canDeleteMessage,
  clampPageSize,
  editRejection,
  serializeMessage,
  validateMessageBody,
} from '../lib/chat';

const senderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  profileImage: true,
} as const;

const messageInclude = {
  sender: { select: senderSelect },
  attachments: true,
} as const;

function requireValidBody(raw: unknown): string {
  const result = validateMessageBody(raw);
  if (!result.ok) throw new AppError(400, result.error);
  return result.body;
}

/** Cursor anchor — the message a before/after page is relative to. */
async function getAnchor(channelId: string, messageId: string) {
  const anchor = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, createdAt: true, channelId: true },
  });
  if (!anchor || anchor.channelId !== channelId) {
    throw new AppError(404, 'Cursor message not found in this channel.');
  }
  return anchor;
}

export interface ListMessagesOptions {
  limit?: number;
  before?: string; // page of older messages (scroll-up)
  after?: string;  // only newer messages (poll delta)
}

/**
 * Messages in ascending (createdAt, id) order. With no cursor, returns the
 * LATEST page. Soft-deleted messages come back as tombstones — never omitted,
 * so ordering and cursors stay stable.
 */
export async function listMessages(channelId: string, opts: ListMessagesOptions = {}) {
  const limit = clampPageSize(opts.limit);

  let cursorWhere: Prisma.MessageWhereInput = {};
  // With no cursor (initial load) we want the newest page, so fetch descending
  // and flip; `before` pages older content the same way. `after` reads forward.
  let fetchDescending = true;
  if (opts.after) {
    cursorWhere = afterCursorWhere(await getAnchor(channelId, opts.after));
    fetchDescending = false;
  } else if (opts.before) {
    cursorWhere = beforeCursorWhere(await getAnchor(channelId, opts.before));
  }

  const rows = await prisma.message.findMany({
    where: { channelId, ...cursorWhere },
    include: messageInclude,
    orderBy: fetchDescending
      ? [{ createdAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  if (fetchDescending) rows.reverse();
  return rows.map(serializeMessage);
}

export async function postMessage(channelId: string, senderId: string, rawBody: unknown) {
  const body = requireValidBody(rawBody);
  const message = await prisma.message.create({
    data: { channelId, senderId, body },
    include: messageInclude,
  });
  return serializeMessage(message);
}

/** Author-only; deletion is terminal (409 on a deleted message). Sets editedAt. */
export async function editMessage(messageId: string, userId: string, rawBody: unknown) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, deletedAt: true },
  });
  if (!existing) throw new AppError(404, 'Message not found.');
  const rejection = editRejection(existing, userId);
  if (rejection) throw new AppError(rejection.status, rejection.error);

  const body = requireValidBody(rawBody);
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { body, editedAt: new Date() },
    include: messageInclude,
  });
  return serializeMessage(message);
}

/**
 * Soft delete — author or moderator. Idempotent: deleting an already-deleted
 * message returns its tombstone unchanged (the original deleter is preserved).
 */
export async function softDeleteMessage(messageId: string, userId: string, isModerator: boolean) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    include: messageInclude,
  });
  if (!existing) throw new AppError(404, 'Message not found.');
  if (existing.deletedAt) return serializeMessage(existing);
  if (!canDeleteMessage(existing, userId, isModerator)) {
    throw new AppError(403, 'You can only delete your own messages.');
  }

  const message = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), deletedByUserId: userId },
    include: messageInclude,
  });
  return serializeMessage(message);
}
