import { Request, Response, NextFunction } from 'express';
import { TeamRole } from '@prisma/client';
import { logAudit } from '../lib/audit';
import {
  createInvitation,
  acceptInvitation,
  declineInvitation,
  getTeamInvitations,
  getUserInvitations,
} from '../services/invitation.service';

export async function createTeamInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: teamId } = req.params;
    const { email, role } = req.body as { email: string; role: TeamRole };
    if (!email || !role) {
      return res.status(400).json({ error: 'email and role are required' });
    }
    const inv = await createInvitation(teamId, req.user!.userId, email, role);
    logAudit(req.user!.userId, 'CREATE_INVITATION', 'invitation', inv.id, { teamId, email, role });
    res.status(201).json(inv);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function listTeamInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const invitations = await getTeamInvitations(req.params.id);
    res.json(invitations);
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await acceptInvitation(req.params.token, req.user!.userId);
    logAudit(req.user!.userId, 'ACCEPT_INVITATION', 'invitation', result.id);
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function declineInvitationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await declineInvitation(req.params.token, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function myInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../lib/prisma');
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const invitations = await getUserInvitations(user.email);
    res.json(invitations);
  } catch (err) {
    next(err);
  }
}
