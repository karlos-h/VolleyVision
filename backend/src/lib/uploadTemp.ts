// Chat and feedback attachments are spooled to disk, not held in memory: on the
// 1 GB Fly machine one 10 x 25 MB request would pin ~250 MB, and a few at once
// crash the process. Services read ONE file at a time (readUpload), so a request
// holds at most 25 MB of file bytes. Pure Node + multer: no prisma import, so
// it stays unit-testable.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

export const UPLOAD_TMP_DIR = path.join(os.tmpdir(), 'vv-uploads');
// Per request, across all files. 10 x 25 MB would also fill the machine's disk.
export const MAX_REQUEST_BYTES = 60 * 1024 * 1024;

const TOO_BIG = { error: `These files are too large together. The limit is ${MAX_REQUEST_BYTES / (1024 * 1024)} MB per message.` };

fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

export function diskUpload(limits: multer.Options['limits']) {
  return multer({
    storage: multer.diskStorage({
      destination: UPLOAD_TMP_DIR,
      // Never the client's name: it must not reach the filesystem path.
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits,
  });
}

/**
 * Mount BEFORE multer. Rejects an oversized declared Content-Length without
 * reading the body, and removes the request's temp files once the response is
 * done (success, validation error, upload failure, client abort alike).
 */
export function uploadTempGuard(req: Request, res: Response, next: NextFunction) {
  res.once('close', () => {
    const files = Array.isArray(req.files) ? req.files : [];
    for (const f of files) fs.promises.unlink(f.path).catch(() => {});
  });
  if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES) {
    res.status(400).json(TOO_BIG);
    return;
  }
  next();
}

/** Mount AFTER multer: chunked bodies have no Content-Length to check up front. */
export function uploadTotalGuard(req: Request, res: Response, next: NextFunction) {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_REQUEST_BYTES) {
    res.status(400).json(TOO_BIG);
    return;
  }
  next();
}

/** The file's bytes, read on demand; callers drop the Buffer before the next file. */
export function readUpload(file: Express.Multer.File): Promise<Buffer> {
  return fs.promises.readFile(file.path);
}
