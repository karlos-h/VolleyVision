// Team Chat — controllers. Channel-scoped permission checks live in the route
// middleware; message-scoped routes (PATCH/DELETE) resolve the message's team
// here to compute membership + moderator status, since the author-level rules
// are enforced in message.service.

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { getOrCreateTeamChannel } from '../services/teamChannel.service';
import {
  listMessages,
  postMessage,
  postMessageWithAttachments,
  editMessage,
  softDeleteMessage,
} from '../services/message.service';
import {
  Permission,
  canModerateChannel,
  hasTeamPermission,
} from '../services/permission.service';

export async function getTeamChannel(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getOrCreateTeamChannel(req.params.teamId);
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

export async function listChannelMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, before, after } = req.query;
    const messages = await listMessages(req.params.channelId, {
      limit: typeof limit === 'string' ? parseInt(limit, 10) : undefined,
      before: typeof before === 'string' ? before : undefined,
      after: typeof after === 'string' ? after : undefined,
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function postChannelMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const message = await postMessage(req.params.channelId, req.user.userId, req.body?.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

/** Multipart: optional `body` field + `files[]` (slice 4). */
export async function uploadChannelMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const message = await postMessageWithAttachments(
      req.params.channelId,
      req.user.userId,
      req.body?.body,
      files,
    );
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

/** Resolve the team a message belongs to (404 if the message doesn't exist). */
async function getMessageTeamId(messageId: string): Promise<string> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { channel: { select: { teamId: true } } },
  });
  if (!message) throw new AppError(404, 'Message not found.');
  return message.channel.teamId;
}

export async function updateMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const teamId = await getMessageTeamId(req.params.messageId);
    // Editing is a form of posting — a member removed from the team (or demoted
    // to VIEWER) loses it immediately, even for their own old messages.
    const allowed = await hasTeamPermission(req.user.userId, teamId, Permission.POST_MESSAGE);
    if (!allowed) throw new AppError(403, 'You do not have permission to perform this action.');
    const message = await editMessage(req.params.messageId, req.user.userId, req.body?.body);
    res.json(message);
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const teamId = await getMessageTeamId(req.params.messageId);
    const isModerator = await canModerateChannel(req.user.userId, teamId);
    if (!isModerator) {
      // Author self-delete still requires live team membership.
      const member = await hasTeamPermission(req.user.userId, teamId, Permission.VIEW_TEAM);
      if (!member) throw new AppError(403, 'You do not have permission to perform this action.');
    }
    const tombstone = await softDeleteMessage(req.params.messageId, req.user.userId, isModerator);
    res.json(tombstone);
  } catch (err) {
    next(err);
  }
}
