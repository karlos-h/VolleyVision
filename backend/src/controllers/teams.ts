import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../lib/audit';
import { syncOwnerMembership } from '../services/teamMembership.service';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

// Iteration 3 — the team's current league season, exposed on team reads so the
// team form can show it and new matches can default their competition from it.
const leagueSeasonInclude = {
  select: {
    id: true,
    name: true,
    league: { select: { id: true, name: true, division: true } },
  },
} as const;

/**
 * Keep a LeagueTeam join row in sync with Team.leagueSeasonId so League Hub
 * (fixtures/standings) sees the same association the team form sets. Additive:
 * a team keeps its historical LeagueTeam rows for prior seasons.
 */
async function syncLeagueTeam(teamId: string, leagueSeasonId: string | null | undefined) {
  if (!leagueSeasonId) return;
  await prisma.leagueTeam.upsert({
    where: { leagueSeasonId_teamId: { leagueSeasonId, teamId } },
    update: {},
    create: { leagueSeasonId, teamId },
  });
}

export async function getTeams(req: Request, res: Response, next: NextFunction) {
  try {
    // Teams are private to their members:
    //  - anonymous:          nothing
    //  - logged-in non-admin: teams they own or are a member of
    //  - admin:               all teams (support/debugging affordance)
    const userId = req.user?.userId ?? null;
    if (!userId) {
      res.json([]);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    const where: Prisma.TeamWhereInput =
      user?.role === 'ADMIN'
        ? {}
        : { OR: [{ ownerId: userId }, { memberships: { some: { userId } } }] };

    const teams = await prisma.team.findMany({
      where,
      include: {
        _count: { select: { players: true, matches: true } },
        owner: { select: ownerSelect },
        leagueSeason: leagueSeasonInclude,
      },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (err) {
    next(err);
  }
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        players: { orderBy: { jerseyNumber: 'asc' } },
        matches: { orderBy: { matchDate: 'desc' }, take: 10 },
        owner: { select: ownerSelect },
        leagueSeason: leagueSeasonInclude,
      },
    });
    if (!team) throw new AppError(404, 'Team not found.');
    res.json(team);
  } catch (err) {
    next(err);
  }
}

export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    const { name, division, season, leagueSeasonId } = req.body;
    if (!name || !season) throw new AppError(400, 'Team name and season are required.');

    // The creator owns the team. This is what makes Team.ownerId safe to be
    // non-nullable — every team has an owner from the moment it exists.
    // The nested create gives every team its single TEAM chat channel in the
    // same transaction (getOrCreateTeamChannel self-heals if it's ever missing).
    const team = await prisma.team.create({
      data: {
        name,
        division,
        season,
        ownerId: req.user.userId,
        leagueSeasonId: leagueSeasonId || null,
        channels: { create: { type: 'TEAM' } },
      },
      include: { owner: { select: ownerSelect }, leagueSeason: leagueSeasonInclude },
    });
    // Give the owner a HEAD_COACH membership so team-scoped reads and the
    // permission checks see them immediately.
    await syncOwnerMembership(team.id, req.user.userId);
    await syncLeagueTeam(team.id, leagueSeasonId);

    logAudit(req.user.userId, 'CREATE_TEAM', 'team', team.id);
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, division, season, leagueSeasonId } = req.body;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: {
        name,
        division,
        season,
        // Only touch the league link when the field is present; `null` clears it.
        ...(leagueSeasonId !== undefined ? { leagueSeasonId: leagueSeasonId || null } : {}),
      },
      include: { owner: { select: ownerSelect }, leagueSeason: leagueSeasonInclude },
    });
    if (leagueSeasonId) await syncLeagueTeam(team.id, leagueSeasonId);
    if (req.user) logAudit(req.user.userId, 'UPDATE_TEAM', 'team', team.id);
    res.json(team);
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.team.delete({ where: { id: req.params.id } });
    if (req.user) logAudit(req.user.userId, 'DELETE_TEAM', 'team', req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
