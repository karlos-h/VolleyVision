import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { resource, limit = '50' } = req.query as Record<string, string>;
    const logs = await prisma.auditLog.findMany({
      where: { userId: req.user!.userId, ...(resource ? { resource } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 200),
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
