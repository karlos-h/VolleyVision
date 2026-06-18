import { Request, Response, NextFunction } from 'express';
import {
  getCoachDashboard,
  getCoachOwnedTeams,
  getCoachMemberTeams,
  getCoachingStats,
} from '../services/coachPortal.service';

export async function coachDashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await getCoachDashboard(req.user!.userId);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}

export async function coachTeamsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const [owned, member] = await Promise.all([
      getCoachOwnedTeams(req.user!.userId),
      getCoachMemberTeams(req.user!.userId),
    ]);
    res.json({ owned, member });
  } catch (err) {
    next(err);
  }
}

export async function coachStatsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getCoachingStats(req.user!.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
