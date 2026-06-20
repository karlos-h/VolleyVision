import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// ─── Videos ──────────────────────────────────────────────────────────────────

export async function uploadVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId } = req.params;
    if (!req.file) throw new AppError(400, 'No video file received.');

    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
    if (!match) {
      fs.unlinkSync(req.file.path);
      throw new AppError(404, 'Match not found.');
    }

    const video = await prisma.video.create({
      data: {
        matchId,
        filename:         req.file.originalname,
        filePath:         req.file.path,
        mimeType:         req.file.mimetype,
        uploadedByUserId: req.user!.userId,
      },
    });
    res.status(201).json(video);
  } catch (err) { next(err); }
}

export async function listVideos(req: Request, res: Response, next: NextFunction) {
  try {
    const videos = await prisma.video.findMany({
      where: { matchId: req.params.matchId },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(videos);
  } catch (err) { next(err); }
}

export async function deleteVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const video = await prisma.video.findUnique({ where: { id: req.params.videoId } });
    if (!video) throw new AppError(404, 'Video not found.');

    // Delete file from disk (best-effort — don't block if file already gone)
    try { fs.unlinkSync(video.filePath); } catch {}

    await prisma.video.delete({ where: { id: video.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── Video file streaming (range-request aware) ───────────────────────────────

export async function streamVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const video = await prisma.video.findUnique({ where: { id: req.params.videoId } });
    if (!video) throw new AppError(404, 'Video not found.');

    const filePath = video.filePath;
    if (!fs.existsSync(filePath)) throw new AppError(404, 'Video file not found on disk.');

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      // Parse "bytes=start-end"
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   video.mimeType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   video.mimeType,
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) { next(err); }
}

// ─── Timestamps ───────────────────────────────────────────────────────────────

export async function createTimestamp(req: Request, res: Response, next: NextFunction) {
  try {
    const { videoId } = req.params;
    const { timestampSeconds, label, eventId } = req.body as {
      timestampSeconds?: number;
      label?: string;
      eventId?: string;
    };

    if (timestampSeconds == null || !label?.trim()) {
      throw new AppError(400, 'timestampSeconds and label are required.');
    }

    const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true } });
    if (!video) throw new AppError(404, 'Video not found.');

    const ts = await prisma.videoTimestamp.create({
      data: {
        videoId,
        timestampSeconds: Number(timestampSeconds),
        label:            label.trim(),
        eventId:          eventId ?? null,
      },
    });
    res.status(201).json(ts);
  } catch (err) { next(err); }
}

export async function listTimestamps(req: Request, res: Response, next: NextFunction) {
  try {
    const video = await prisma.video.findUnique({ where: { id: req.params.videoId }, select: { id: true } });
    if (!video) throw new AppError(404, 'Video not found.');

    const timestamps = await prisma.videoTimestamp.findMany({
      where: { videoId: req.params.videoId },
      orderBy: { timestampSeconds: 'asc' },
    });
    res.json(timestamps);
  } catch (err) { next(err); }
}

export async function deleteTimestamp(req: Request, res: Response, next: NextFunction) {
  try {
    const ts = await prisma.videoTimestamp.findUnique({ where: { id: req.params.timestampId } });
    if (!ts) throw new AppError(404, 'Timestamp not found.');
    await prisma.videoTimestamp.delete({ where: { id: ts.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}
