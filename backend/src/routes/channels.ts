// Team Chat routes. Mounted at /api/v1 (paths here carry their own prefixes,
// like routes/videos.ts) because the surface spans three resources: the
// team-scoped channel getter, channel-scoped messages, and message-scoped
// edit/delete.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireChannelPermission, requireTeamPermission } from '../middleware/permissions';
import { Permission } from '../services/permission.service';
import {
  getTeamChannel,
  listChannelMessages,
  postChannelMessage,
  updateMessage,
  deleteMessage,
} from '../controllers/messages';

const router = Router();

// The team's single TEAM channel (get-or-create; readable by every member).
router.get(
  '/teams/:teamId/channel',
  requireAuth,
  requireTeamPermission(Permission.VIEW_TEAM, 'teamId'),
  getTeamChannel,
);

router.get(
  '/channels/:channelId/messages',
  requireAuth,
  requireChannelPermission(Permission.VIEW_TEAM),
  listChannelMessages,
);
router.post(
  '/channels/:channelId/messages',
  requireAuth,
  requireChannelPermission(Permission.POST_MESSAGE),
  postChannelMessage,
);

// Author/moderator rules resolved in the controller + service.
router.patch('/messages/:messageId', requireAuth, updateMessage);
router.delete('/messages/:messageId', requireAuth, deleteMessage);

export default router;
