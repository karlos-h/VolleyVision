import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { calculatePlayerStats, calculateSetStats, calculateStats } from '../lib/analytics';
import { HOME_POINT_SET, AWAY_POINT_SET } from '../lib/scoringRules';
import { calculateMomentum } from '../services/momentum.service';
import { calculateRotations } from '../services/rotation.service';
import { generateMatchReport } from '../services/report.service';
import { narrateMatchReport } from '../services/aiNarration.service';
import { buildDetailedHeatmap } from '../lib/heatmap';
import { generateCoachingRecommendations } from '../services/coachingRecommendations.service';
import { generatePlayerDevelopmentReport } from '../services/playerDevelopment.service';
import { generateSeasonIntelligence } from '../services/seasonIntelligence.service';

// ─── Shared query shapes ──────────────────────────────────────────────────────

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

const VALID_ZONE_FILTER     = { gte: 1, lte: 6 } as const;
const VALID_ROTATION_FILTER = { gte: 1, lte: 6 } as const;

// ─── Heatmap helper (shared across match / team / player) ─────────────────────

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

// ─── Detailed heatmap helper — implemented in lib/heatmap.ts, imported above ──

// ─── Advanced metrics helper ──────────────────────────────────────────────────

function buildAdvancedMetrics(events: { eventType: string; setNumber: number }[]) {
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
  const c = (key: string) => counts[key] ?? 0;

  const passAttempts   = c('PASS_3') + c('PASS_2') + c('PASS_1') + c('PASS_0');
  const qualityPasses  = c('PASS_3') + c('PASS_2');
  const sideOutEfficiency = passAttempts > 0 ? Math.round((qualityPasses / passAttempts) * 1000) / 10 : null;
  const perfectPassRate   = passAttempts > 0 ? Math.round((c('PASS_3') / passAttempts) * 1000) / 10 : null;

  const serveAttempts     = c('ACE') + c('SERVICE_ERROR') + c('SERVE_IN');
  const aceRate           = serveAttempts > 0 ? Math.round((c('ACE') / serveAttempts) * 1000) / 10 : null;
  const serveErrorRate    = serveAttempts > 0 ? Math.round((c('SERVICE_ERROR') / serveAttempts) * 1000) / 10 : null;
  const servePositiveRate = serveAttempts > 0 ? Math.round(((c('ACE') + c('SERVE_IN')) / serveAttempts) * 1000) / 10 : null;

  const attackAttempts = c('KILL') + c('ATTACK_ERROR') + c('ATTACK_ATTEMPT');
  const killRate       = attackAttempts > 0 ? Math.round((c('KILL') / attackAttempts) * 1000) / 10 : null;
  const hittingPct     = attackAttempts > 0
    ? Math.round(((c('KILL') - c('ATTACK_ERROR')) / attackAttempts) * 1000) / 1000 : null;

  const soloBlocks   = c('SOLO_BLOCK');
  const blockAssists = c('BLOCK_ASSIST');
  const totalBlocks  = soloBlocks + blockAssists * 0.5;
  const setsPlayed   = new Set(events.map((e) => e.setNumber)).size;
  const blocksPerSet = setsPlayed > 0 ? Math.round((totalBlocks / setsPlayed) * 100) / 100 : null;

  return {
    sideOut: { attempts: passAttempts, qualityPasses, efficiencyPct: sideOutEfficiency, perfectPassRate,
               pass3: c('PASS_3'), pass2: c('PASS_2'), pass1: c('PASS_1'), pass0: c('PASS_0') },
    serve:   { attempts: serveAttempts, aces: c('ACE'), errors: c('SERVICE_ERROR'),
               aceRate, errorRate: serveErrorRate, positiveRate: servePositiveRate },
    attack:  { attempts: attackAttempts, kills: c('KILL'), errors: c('ATTACK_ERROR'), killRate, hittingPct },
    blocking:{ soloBlocks, blockAssists, totalBlocks, blocksPerSet },
    setsPlayed,
  };
}

// ─── Controllers — data fetch → service → respond ────────────────────────────

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
        id: match.id, matchDate: match.matchDate, opponent: match.opponent,
        competition: match.competition, venue: match.venue, status: match.status,
        setScores: match.setScores, teamId: match.teamId, teamName: match.team.name,
        homeScore: match.homeScore, awayScore: match.awayScore,
        homeSetsWon: match.homeSetsWon, awaySetsWon: match.awaySetsWon,
      },
      teamStats:   calculateStats(match.events),
      playerStats: calculatePlayerStats(match.team.players, match.events),
      setStats:    calculateSetStats(match.events),
    });
  } catch (err) { next(err); }
}

export async function getTeamAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        players: { select: playerSelect, orderBy: { jerseyNumber: 'asc' } },
        matches: { select: { id: true, status: true, setScores: true } },
      },
    });
    if (!team) throw new AppError(404, 'Team not found.');
    const events = await prisma.event.findMany({ where: { match: { teamId: team.id } }, select: eventSelect });
    res.json({
      team: { id: team.id, name: team.name, division: team.division, season: team.season },
      matchSummary: {
        total: team.matches.length,
        completed:  team.matches.filter((m) => m.status === 'COMPLETED').length,
        inProgress: team.matches.filter((m) => m.status === 'IN_PROGRESS').length,
        scheduled:  team.matches.filter((m) => m.status === 'SCHEDULED').length,
      },
      teamStats:   calculateStats(events),
      playerStats: calculatePlayerStats(team.players, events),
    });
  } catch (err) { next(err); }
}

async function fetchTeamTrends(teamId: string) {
  const matches = await prisma.match.findMany({
    where: { teamId, status: 'COMPLETED' },
    orderBy: { matchDate: 'asc' },
    include: { events: { select: eventSelect } },
  });
  return matches.map((m) => {
    const s = calculateStats(m.events);
    return { matchId: m.id, opponent: m.opponent, matchDate: m.matchDate,
             kills: s.kills, aces: s.aces, blocks: s.totalBlocks, digs: s.digs,
             hittingPercentage: s.hittingPercentage };
  });
}

export async function getTeamTrends(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await fetchTeamTrends(req.params.teamId));
  } catch (err) { next(err); }
}

export async function getSeasonIntelligence(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await prisma.team.findUnique({ where: { id: req.params.teamId }, select: { id: true } });
    if (!team) throw new AppError(404, 'Team not found.');
    const trends = await fetchTeamTrends(req.params.teamId);
    res.json(generateSeasonIntelligence(trends));
  } catch (err) { next(err); }
}

export async function getMatchZones(req: Request, res: Response, next: NextFunction) {
  try {
    const CATEGORY_TYPES: Record<string, string[]> = {
      attack: ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT'],
      serve:  ['ACE', 'SERVICE_ERROR', 'SERVE_IN'],
      pass:   ['PASS_3', 'PASS_2', 'PASS_1', 'PASS_0'],
      block:  ['SOLO_BLOCK', 'BLOCK_ASSIST', 'BLOCK_ERROR'],
      defence:['DIG', 'DIG_ERROR'],
      set:    ['ASSIST', 'SETTING_ERROR'],
    };
    const { category } = req.query;
    const typeFilter = category && CATEGORY_TYPES[category as string]
      ? { eventType: { in: CATEGORY_TYPES[category as string] as any } } : {};
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId, courtZone: VALID_ZONE_FILTER, ...typeFilter },
      select: { courtZone: true, eventType: true },
    });
    const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
    for (const e of events) { if (e.courtZone != null) counts[String(e.courtZone)]++; }
    res.json(counts);
  } catch (err) { next(err); }
}

export async function getMatchHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildHeatmap(events));
  } catch (err) { next(err); }
}

export async function getTeamHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { match: { teamId: req.params.teamId }, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildHeatmap(events));
  } catch (err) { next(err); }
}

export async function getPlayerHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.playerId }, select: { id: true } });
    if (!player) throw new AppError(404, 'Player not found.');
    const events = await prisma.event.findMany({
      where: { playerId: req.params.playerId, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildHeatmap(events));
  } catch (err) { next(err); }
}

export async function getMatchAdvanced(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({ where: { matchId: req.params.matchId }, select: { eventType: true, setNumber: true } });
    res.json(buildAdvancedMetrics(events));
  } catch (err) { next(err); }
}

export async function getTeamAdvanced(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({ where: { match: { teamId: req.params.teamId } }, select: { eventType: true, setNumber: true } });
    res.json(buildAdvancedMetrics(events));
  } catch (err) { next(err); }
}

export async function getMatchMomentum(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId, eventType: { in: [...HOME_POINT_SET, ...AWAY_POINT_SET] as any } },
      select: { eventType: true, setNumber: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });
    res.json(calculateMomentum(events));
  } catch (err) { next(err); }
}

export async function getMatchRotations(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId, rotationNumber: VALID_ROTATION_FILTER,
               eventType: { in: [...HOME_POINT_SET, ...AWAY_POINT_SET] as any } },
      select: { rotationNumber: true, eventType: true },
    });
    res.json(calculateRotations(events));
  } catch (err) { next(err); }
}

export async function getTeamRotations(req: Request, res: Response, next: NextFunction) {
  try {
    const { season } = req.query;
    const events = await prisma.event.findMany({
      where: {
        match: { teamId: req.params.teamId, ...(season ? { team: { season: String(season) } } : {}) },
        rotationNumber: VALID_ROTATION_FILTER,
        eventType: { in: [...HOME_POINT_SET, ...AWAY_POINT_SET] as any },
      },
      select: { rotationNumber: true, eventType: true },
    });
    res.json(calculateRotations(events));
  } catch (err) { next(err); }
}

export async function getMatchReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId } = req.params;
    const [match, events, players] = await Promise.all([
      prisma.match.findUnique({ where: { id: matchId }, include: { team: { select: { name: true } } } }),
      prisma.event.findMany({
        where: { matchId },
        select: { eventType: true, setNumber: true, courtZone: true, rotationNumber: true, playerId: true, recordedAt: true },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.player.findMany({
        where: { team: { matches: { some: { id: matchId } } } },
        select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true },
      }),
    ]);
    if (!match) throw new AppError(404, 'Match not found.');
    res.json(generateMatchReport(
      { teamName: match.team.name, opponent: match.opponent,
        homeSetsWon: match.homeSetsWon, awaySetsWon: match.awaySetsWon,
        setScores: match.setScores },
      events,
      players,
    ));
  } catch (err) { next(err); }
}

export async function getMatchZoneDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildDetailedHeatmap(events));
  } catch (err) { next(err); }
}

export async function getTeamZoneDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { match: { teamId: req.params.teamId }, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildDetailedHeatmap(events));
  } catch (err) { next(err); }
}

export async function getPlayerZoneDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.playerId }, select: { id: true } });
    if (!player) throw new AppError(404, 'Player not found.');
    const events = await prisma.event.findMany({
      where: { playerId: req.params.playerId, courtZone: VALID_ZONE_FILTER },
      select: { courtZone: true, eventType: true },
    });
    res.json(buildDetailedHeatmap(events));
  } catch (err) { next(err); }
}

export async function getTeamCoachingRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const { teamId } = req.params;
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new AppError(404, 'Team not found.');

    const [statsEvents, rotationEvents, zoneEvents] = await Promise.all([
      prisma.event.findMany({ where: { match: { teamId } }, select: eventSelect }),
      prisma.event.findMany({
        where: { match: { teamId }, rotationNumber: VALID_ROTATION_FILTER,
                 eventType: { in: [...HOME_POINT_SET, ...AWAY_POINT_SET] as any } },
        select: { rotationNumber: true, eventType: true },
      }),
      prisma.event.findMany({
        where: { match: { teamId }, courtZone: VALID_ZONE_FILTER },
        select: { courtZone: true, eventType: true },
      }),
    ]);

    res.json(generateCoachingRecommendations({
      stats: calculateStats(statsEvents),
      rotations: calculateRotations(rotationEvents),
      zones: buildDetailedHeatmap(zoneEvents),
    }));
  } catch (err) { next(err); }
}

export async function getMatchReportNarrative(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId } = req.params;
    const [match, events, players] = await Promise.all([
      prisma.match.findUnique({ where: { id: matchId }, include: { team: { select: { name: true } } } }),
      prisma.event.findMany({
        where: { matchId },
        select: { eventType: true, setNumber: true, courtZone: true, rotationNumber: true, playerId: true, recordedAt: true },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.player.findMany({
        where: { team: { matches: { some: { id: matchId } } } },
        select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true },
      }),
    ]);
    if (!match) throw new AppError(404, 'Match not found.');
    const report = generateMatchReport(
      { teamName: match.team.name, opponent: match.opponent,
        homeSetsWon: match.homeSetsWon, awaySetsWon: match.awaySetsWon,
        setScores: match.setScores },
      events,
      players,
    );
    const narrative = await narrateMatchReport(report);
    res.json(narrative);
  } catch (err) { next(err); }
}

export async function getPlayerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.playerId }, select: playerSelect });
    if (!player) throw new AppError(404, 'Player not found.');
    const matchId = typeof req.query.matchId === 'string' ? req.query.matchId : undefined;
    const events = await prisma.event.findMany({
      where: { playerId: player.id, ...(matchId ? { matchId } : {}) },
      select: eventSelect,
    });
    res.json({ player, matchId: matchId ?? null, stats: calculateStats(events), setStats: calculateSetStats(events) });
  } catch (err) { next(err); }
}

export async function getPlayerDevelopmentReport(req: Request, res: Response, next: NextFunction) {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.playerId }, select: playerSelect });
    if (!player) throw new AppError(404, 'Player not found.');

    // Fetch all completed matches the player appeared in, ordered chronologically.
    const matches = await prisma.match.findMany({
      where: { status: 'COMPLETED', events: { some: { playerId: player.id } } },
      select: { id: true, matchDate: true },
      orderBy: { matchDate: 'asc' },
    });

    // For each match, aggregate that player's events into a StatLine.
    const matchStats = await Promise.all(
      matches.map(async (m) => {
        const events = await prisma.event.findMany({
          where: { matchId: m.id, playerId: player.id },
          select: eventSelect,
        });
        return { matchDate: m.matchDate, stats: calculateStats(events) };
      }),
    );

    res.json(generatePlayerDevelopmentReport(matchStats));
  } catch (err) { next(err); }
}
