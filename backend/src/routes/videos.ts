import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import { requireMatchPermission } from '../middleware/permissions';
import { Permission } from '../services/permission.service';
import { prisma } from '../lib/prisma';
import { hasTeamPermission } from '../services/permission.service';
import {
  uploadVideo,
  listVideos,
  deleteVideo,
  streamVideo,
  createTimestamp,
  listTimestamps,
  deleteTimestamp,
} from '../controllers/videos';

// ─── Multer storage config ────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/videos'),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: mp4, mov, webm.`));
    }
  },
});

// ─── Permission middleware for video-level operations ─────────────────────────
// Resolves teamId from the video's match so we can use hasTeamPermission.

function requireVideoPermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
    const video = await prisma.video.findUnique({
      where: { id: req.params.videoId },
      select: { match: { select: { teamId: true } } },
    });
    if (!video) { res.status(404).json({ error: 'Video not found.' }); return; }
    const allowed = await hasTeamPermission(req.user.userId, video.match.teamId, permission);
    if (!allowed) { res.status(403).json({ error: 'You do not have permission to perform this action.' }); return; }
    next();
  };
}

function requireTimestampPermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.' }); return; }
    const ts = await prisma.videoTimestamp.findUnique({
      where: { id: req.params.timestampId },
      select: { video: { select: { match: { select: { teamId: true } } } } },
    });
    if (!ts) { res.status(404).json({ error: 'Timestamp not found.' }); return; }
    const allowed = await hasTeamPermission(req.user.userId, ts.video.match.teamId, permission);
    if (!allowed) { res.status(403).json({ error: 'You do not have permission to perform this action.' }); return; }
    next();
  };
}

// ─── Multer error normalizer ──────────────────────────────────────────────────
// multer throws its own error types; convert to our AppError shape.

function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: `File too large. Maximum allowed size is 500 MB.` });
  } else if (err instanceof Error) {
    res.status(400).json({ error: err.message });
  } else {
    next(err);
  }
}

const router = Router();

// ─── Match-scoped video routes ────────────────────────────────────────────────
router.post(
  '/matches/:matchId/videos',
  requireAuth,
  requireMatchPermission(Permission.TRACK_MATCH),
  upload.single('video'),
  handleMulterError,
  uploadVideo,
);
router.get('/matches/:matchId/videos', listVideos);

// ─── Video-level routes ───────────────────────────────────────────────────────
router.get('/videos/:videoId/file', streamVideo);
router.delete('/videos/:videoId', requireAuth, requireVideoPermission(Permission.TRACK_MATCH), deleteVideo);
router.post('/videos/:videoId/timestamps', requireAuth, requireVideoPermission(Permission.TRACK_MATCH), createTimestamp);
router.get('/videos/:videoId/timestamps', listTimestamps);
router.delete('/timestamps/:timestampId', requireAuth, requireTimestampPermission(Permission.TRACK_MATCH), deleteTimestamp);

export default router;
