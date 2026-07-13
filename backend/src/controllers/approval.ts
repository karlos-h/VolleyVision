import { Request, Response, NextFunction } from 'express';
import { ApprovalStatus } from '@prisma/client';
import { logAudit } from '../lib/audit';
import { listApprovalRequests, approveRequest, rejectRequest } from '../services/approval.service';

export async function listTeamApprovalRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as ApprovalStatus | undefined;
    const requests = await listApprovalRequests(req.params.id, status);
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

export async function approveApprovalRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const resolved = await approveRequest(req.params.id, req.user!.userId);
    logAudit(req.user!.userId, 'APPROVE_REQUEST', 'approval_request', resolved.id);
    res.json(resolved);
  } catch (err) {
    next(err);
  }
}

export async function rejectApprovalRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const resolved = await rejectRequest(req.params.id, req.user!.userId);
    logAudit(req.user!.userId, 'REJECT_REQUEST', 'approval_request', resolved.id);
    res.json(resolved);
  } catch (err) {
    next(err);
  }
}
