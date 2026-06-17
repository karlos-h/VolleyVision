import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  calculatePlayerStats,
  calculateSetStats,
  calculateStats,
} from '../lib/analytics';

const playerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  jerseyNumber: true,
  position: true,
  teamId: true,
} as const;

const eventSelect = {
  eventType: true,
  playerId: true,
  setNumber: true,
} as const;

export async function getMatchAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: {
        team: { include: { players: { select: playerSelect, orderBy: { jerseyNumber: 'asc' } } } },
        events: { select: eventSelect },
      },
    });
    if (!match) throw new AppError(404, 'Match not found.');

    res.json({
      match: {
        id: match.id,
        matchDate: match.matchDate,
        opponent: match.opponent,
        competition: match.competition,
        venue: match.venue,
        status: match.status,
        setScores: match.setScores,
        teamId: match.teamId,
        teamName: match.team.name,
      },
      teamStats: calculateStats(match.events),
      playerStats: calculatePlayerStats(match.team.players, match.events),
      setStats: calculateSetStats(match.events),
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        players: { select: playerSelect, orderBy: { jerseyNumber: 'asc' } },
        matches: {
          select: { id: true, status: true, setScores: true },
        },
      },
    });
    if (!team) throw new AppError(404, 'Team not found.');

    const events = await prisma.event.findMany({
      where: { match: { teamId: team.id } },
      select: eventSelect,
    });

    res.json({
      team: {
        id: team.id,
        name: team.name,
        division: team.division,
        season: team.season,
      },
      matchSummary: {
        total: team.matches.length,
        completed: team.matches.filter((match) => match.status === 'COMPLETED').length,
        inProgress: team.matches.filter((match) => match.status === 'IN_PROGRESS').length,
        scheduled: team.matches.filter((match) => match.status === 'SCHEDULED').length,
      },
      teamStats: calculateStats(events),
      playerStats: calculatePlayerStats(team.players, events),
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamTrends(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const matches = await prisma.match.findMany({
      where: {
        teamId: req.params.teamId,
        status: 'COMPLETED',
      },
      orderBy: {
        matchDate: 'asc',
      },
      include: {
        events: {
          select: eventSelect,
        },
      },
    });

    const trends = matches.map((match) => {
      const stats = calculateStats(match.events);

      return {
        matchId: match.id,
        opponent: match.opponent,
        matchDate: match.matchDate,
        kills: stats.kills,
        aces: stats.aces,
        blocks: stats.totalBlocks,
        digs: stats.digs,
        hittingPercentage: stats.hittingPercentage,
      };
    });

    res.json(trends);
  } catch (err) {
    next(err);
  }
}

export async function getPlayerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      select: playerSelect,
    });
    if (!player) throw new AppError(404, 'Player not found.');

    const matchId = typeof req.query.matchId === 'string' ? req.query.matchId : undefined;
    const events = await prisma.event.findMany({
      where: { playerId: player.id, ...(matchId ? { matchId } : {}) },
      select: eventSelect,
    });

    res.json({
      player,
      matchId: matchId ?? null,
      stats: calculateStats(events),
      setStats: calculateSetStats(events),
    });
  } catch (err) {
    next(err);
  }
}
