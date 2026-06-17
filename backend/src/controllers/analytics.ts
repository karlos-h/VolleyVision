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

// Only aggregate zones that passed validation on write (1–6).
// Guards against any legacy rows or direct DB writes outside the API.
const VALID_ZONE_FILTER = { gte: 1, lte: 6 } as const;

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

// Sprint 2 — zone counts for a match, optionally filtered by event type category
// Returns { "1": 12, "2": 8, ... } for zones 1–6
export async function getMatchZones(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId } = req.params;
    const { category } = req.query; // optional: attack | serve | pass | block | defence | set

    const CATEGORY_TYPES: Record<string, string[]> = {
      attack: ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT'],
      serve:  ['ACE', 'SERVICE_ERROR', 'SERVE_IN'],
      pass:   ['PASS_3', 'PASS_2', 'PASS_1', 'PASS_0'],
      block:  ['SOLO_BLOCK', 'BLOCK_ASSIST', 'BLOCK_ERROR'],
      defence:['DIG', 'DIG_ERROR'],
      set:    ['ASSIST', 'SETTING_ERROR'],
    };

    const typeFilter =
      category && CATEGORY_TYPES[category as string]
        ? { eventType: { in: CATEGORY_TYPES[category as string] as any } }
        : {};

    const events = await prisma.event.findMany({
      where: { matchId, courtZone: VALID_ZONE_FILTER, ...typeFilter },
      select: { courtZone: true, eventType: true },
    });

    // Build counts for zones 1–6
    const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
    for (const e of events) {
      if (e.courtZone != null) counts[String(e.courtZone)]++;
    }

    res.json(counts);
  } catch (err) {
    next(err);
  }
}

// Shared heatmap aggregation — reused by match, team, and player endpoints
const HEATMAP_CATEGORIES = {
  attack:  ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT'],
  serve:   ['ACE', 'SERVICE_ERROR', 'SERVE_IN'],
  pass:    ['PASS_3', 'PASS_2', 'PASS_1', 'PASS_0'],
  block:   ['SOLO_BLOCK', 'BLOCK_ASSIST', 'BLOCK_ERROR'],
  defence: ['DIG', 'DIG_ERROR'],
} as const;

function buildHeatmap(events: { courtZone: number | null; eventType: string }[]) {
  const empty = (): Record<string, number> => ({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 });
  const result: Record<string, Record<string, number>> = {
    attack: empty(), serve: empty(), pass: empty(), block: empty(), defence: empty(), all: empty(),
  };
  for (const e of events) {
    if (e.courtZone == null) continue;
    const z = String(e.courtZone);
    result.all[z]++;
    for (const [cat, types] of Object.entries(HEATMAP_CATEGORIES)) {
      if ((types as readonly string[]).includes(e.eventType)) result[cat][z]++;
    }
  }
  return result;
}

// Sprint 3 — per-category zone breakdown for heat maps (match scope)
export async function getMatchHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildHeatmap(events));
  } catch (err) {
    next(err);
  }
}

// Sprint 3 — per-category zone breakdown for heat maps (team/season scope)
export async function getTeamHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { match: { teamId: req.params.teamId }, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildHeatmap(events));
  } catch (err) {
    next(err);
  }
}

// Phase 3.1 Task 3 — per-category zone breakdown for a single player
export async function getPlayerHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      select: { id: true },
    });
    if (!player) throw new AppError(404, 'Player not found.');

    const events = await prisma.event.findMany({
      where: { playerId: req.params.playerId, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildHeatmap(events));
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
