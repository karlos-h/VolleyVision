import { Request, Response, NextFunction } from 'express';
import { verifyOwnership } from '../services/teamOwnership.service';

/** Express middleware that verifies the authenticated user owns the team in :id or :teamId. */
export async function requireTeamOwner(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const teamId = req.params.id ?? req.params.teamId;
    await verifyOwnership(teamId, req.user.userId);
    next();
  } catch (err) {
    next(err);
  }
}
