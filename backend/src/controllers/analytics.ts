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
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homeSetsWon: match.homeSetsWon,
        awaySetsWon: match.awaySetsWon,
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

// Phase 4 Sprint 6 — Automated Match Report
export async function getMatchReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId } = req.params;

    // Load everything in parallel
    const [match, events, playerRows] = await Promise.all([
      prisma.match.findUnique({
        where: { id: matchId },
        include: {
          team: { select: { name: true } },
        },
      }),
      prisma.event.findMany({
        where: { matchId },
        select: {
          eventType: true,
          setNumber: true,
          courtZone: true,
          rotationNumber: true,
          playerId: true,
          recordedAt: true,
        },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.player.findMany({
        where: { team: { matches: { some: { id: matchId } } } },
        select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true },
      }),
    ]);

    if (!match) throw new AppError(404, 'Match not found.');

    // ── Result ──────────────────────────────────────────────────────────────
    const teamName = match.team.name;
    const opponent = match.opponent;
    const homeSets = match.homeSetsWon;
    const awaySets = match.awaySetsWon;
    const winner: 'home' | 'away' | 'in_progress' =
      homeSets >= 3 ? 'home' : awaySets >= 3 ? 'away' : 'in_progress';
    const resultText =
      winner === 'home'
        ? `${teamName} defeated ${opponent} ${homeSets}–${awaySets}`
        : winner === 'away'
        ? `${opponent} defeated ${teamName} ${awaySets}–${homeSets}`
        : `${teamName} vs ${opponent} — Match in progress`;

    // ── Top Performer ───────────────────────────────────────────────────────
    const playerCounts: Record<string, Record<string, number>> = {};
    for (const e of events) {
      if (!playerCounts[e.playerId]) playerCounts[e.playerId] = {};
      playerCounts[e.playerId][e.eventType] = (playerCounts[e.playerId][e.eventType] ?? 0) + 1;
    }

    const c = (pid: string, key: string) => playerCounts[pid]?.[key] ?? 0;
    const score = (pid: string) =>
      c(pid, 'KILL') * 2 +
      c(pid, 'ACE') * 2 +
      c(pid, 'SOLO_BLOCK') * 1.5 +
      c(pid, 'BLOCK_ASSIST') * 0.75 +
      c(pid, 'DIG') * 0.5 +
      c(pid, 'ASSIST') * 0.5;

    const topPid = playerRows.reduce<string | null>((best, p) =>
      best === null || score(p.id) > score(best) ? p.id : best, null);
    const topPlayer = topPid ? playerRows.find((p) => p.id === topPid) : null;

    const topPerformer = topPlayer && score(topPlayer.id) > 0
      ? {
          player: topPlayer,
          kills: c(topPlayer.id, 'KILL'),
          aces: c(topPlayer.id, 'ACE'),
          blocks: c(topPlayer.id, 'SOLO_BLOCK') + c(topPlayer.id, 'BLOCK_ASSIST') * 0.5,
          digs: c(topPlayer.id, 'DIG'),
          assists: c(topPlayer.id, 'ASSIST'),
        }
      : null;

    // ── Momentum ────────────────────────────────────────────────────────────
    const scoringEvents = events.filter(
      (e) => HOME_SCORE_EVENTS.has(e.eventType) || AWAY_SCORE_EVENTS.has(e.eventType)
    );
    let longestRun = 0;
    let longestRunTeam: 'home' | 'away' = 'home';
    let currentRun = 0;
    let currentRunTeam: 'home' | 'away' | null = null;
    let leadChanges = 0;
    let homeScore = 0;
    let awayScore = 0;
    let largestHomeLead = 0;
    let largestAwayLead = 0;
    let prevLead = 0;

    for (const e of scoringEvents) {
      const scorer: 'home' | 'away' = HOME_SCORE_EVENTS.has(e.eventType) ? 'home' : 'away';
      if (scorer === 'home') homeScore++;
      else awayScore++;
      currentRun = scorer === currentRunTeam ? currentRun + 1 : 1;
      currentRunTeam = scorer;
      if (currentRun > longestRun) { longestRun = currentRun; longestRunTeam = scorer; }
      const lead = homeScore - awayScore;
      if (prevLead !== 0 && Math.sign(lead) !== Math.sign(prevLead)) leadChanges++;
      largestHomeLead = Math.max(largestHomeLead, lead);
      largestAwayLead = Math.max(largestAwayLead, -lead);
      prevLead = lead;
    }

    // ── Attack / Serve / HeatMap ─────────────────────────────────────────────
    const attackEvents = events.filter((e) => ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT'].includes(e.eventType));
    const serveEvents = events.filter((e) => ['ACE', 'SERVICE_ERROR', 'SERVE_IN'].includes(e.eventType));
    const kills = attackEvents.filter((e) => e.eventType === 'KILL').length;
    const attackErrors = attackEvents.filter((e) => e.eventType === 'ATTACK_ERROR').length;
    const killRate = attackEvents.length > 0 ? Math.round((kills / attackEvents.length) * 1000) / 10 : null;
    const hittingPct = attackEvents.length > 0
      ? Math.round(((kills - attackErrors) / attackEvents.length) * 1000) / 1000
      : null;
    const aces = serveEvents.filter((e) => e.eventType === 'ACE').length;
    const aceRate = serveEvents.length > 0 ? Math.round((aces / serveEvents.length) * 1000) / 10 : null;

    // Heat map: top attack zone
    const zoneCounts: Record<number, number> = {};
    for (const e of attackEvents) {
      if (e.courtZone != null && e.courtZone >= 1 && e.courtZone <= 6) {
        zoneCounts[e.courtZone] = (zoneCounts[e.courtZone] ?? 0) + 1;
      }
    }
    const zoneEntries = Object.entries(zoneCounts).map(([z, n]) => ({ zone: Number(z), count: n }));
    const totalZoneAttacks = zoneEntries.reduce((s, z) => s + z.count, 0);
    const topZone = zoneEntries.length
      ? zoneEntries.reduce((a, b) => (b.count > a.count ? b : a))
      : null;
    const heatMapHighlight = topZone && totalZoneAttacks > 0
      ? `${Math.round((topZone.count / totalZoneAttacks) * 100)}% of attacks originated from Zone ${topZone.zone}`
      : null;

    // ── Best Rotation ────────────────────────────────────────────────────────
    const rotCounts: Record<number, { won: number; lost: number }> = {};
    for (let r = 1; r <= 6; r++) rotCounts[r] = { won: 0, lost: 0 };
    for (const e of events) {
      if (e.rotationNumber == null || e.rotationNumber < 1 || e.rotationNumber > 6) continue;
      if (HOME_SCORE_EVENTS.has(e.eventType)) rotCounts[e.rotationNumber].won++;
      else if (AWAY_SCORE_EVENTS.has(e.eventType)) rotCounts[e.rotationNumber].lost++;
    }
    const rotStats = Object.entries(rotCounts)
      .map(([r, { won, lost }]) => ({
        rotation: Number(r),
        won,
        lost,
        net: won - lost,
        efficiency: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
      }))
      .filter((r) => r.won + r.lost > 0);
    const bestRotation = rotStats.length ? rotStats.reduce((a, b) => (b.net > a.net ? b : a)) : null;

    res.json({
      generatedAt: new Date().toISOString(),
      result: {
        teamName,
        opponent,
        homeSetsWon: homeSets,
        awaySetsWon: awaySets,
        winner,
        resultText,
        setScores: Array.isArray(match.setScores) ? match.setScores : [],
      },
      topPerformer,
      momentum: scoringEvents.length > 0 ? {
        longestRun,
        longestRunTeam: longestRunTeam === 'home' ? teamName : opponent,
        leadChanges,
        largestHomeLead,
        largestAwayLead,
      } : null,
      attack: { killRate, hittingPct, kills, errors: attackErrors, attempts: attackEvents.length },
      serve: { aceRate, aces, attempts: serveEvents.length },
      heatMapHighlight,
      bestRotation,
    });
  } catch (err) {
    next(err);
  }
}

// Phase 4 Sprint 5 — Advanced Performance Metrics
function buildAdvancedMetrics(events: { eventType: string; setNumber: number }[]) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
  }

  const c = (key: string) => counts[key] ?? 0;

  // Side-out efficiency: quality passes (2 or 3) / total passes
  const passAttempts = c('PASS_3') + c('PASS_2') + c('PASS_1') + c('PASS_0');
  const qualityPasses = c('PASS_3') + c('PASS_2');
  const sideOutEfficiency = passAttempts > 0 ? Math.round((qualityPasses / passAttempts) * 1000) / 10 : null;
  const perfectPassRate = passAttempts > 0 ? Math.round((c('PASS_3') / passAttempts) * 1000) / 10 : null;

  // Serve efficiency
  const serveAttempts = c('ACE') + c('SERVICE_ERROR') + c('SERVE_IN');
  const aceRate = serveAttempts > 0 ? Math.round((c('ACE') / serveAttempts) * 1000) / 10 : null;
  const serveErrorRate = serveAttempts > 0 ? Math.round((c('SERVICE_ERROR') / serveAttempts) * 1000) / 10 : null;
  const servePositiveRate = serveAttempts > 0 ? Math.round(((c('ACE') + c('SERVE_IN')) / serveAttempts) * 1000) / 10 : null;

  // Attack metrics
  const attackAttempts = c('KILL') + c('ATTACK_ERROR') + c('ATTACK_ATTEMPT');
  const killRate = attackAttempts > 0 ? Math.round((c('KILL') / attackAttempts) * 1000) / 10 : null;
  const hittingPct = attackAttempts > 0
    ? Math.round(((c('KILL') - c('ATTACK_ERROR')) / attackAttempts) * 1000) / 1000
    : null;

  // Blocking efficiency
  const soloBlocks = c('SOLO_BLOCK');
  const blockAssists = c('BLOCK_ASSIST');
  const totalBlocks = soloBlocks + blockAssists * 0.5;
  const sets = new Set(events.map((e) => e.setNumber));
  const setsPlayed = sets.size;
  const blocksPerSet = setsPlayed > 0 ? Math.round((totalBlocks / setsPlayed) * 100) / 100 : null;

  return {
    sideOut: {
      attempts: passAttempts,
      qualityPasses,
      efficiencyPct: sideOutEfficiency,
      perfectPassRate,
      pass3: c('PASS_3'),
      pass2: c('PASS_2'),
      pass1: c('PASS_1'),
      pass0: c('PASS_0'),
    },
    serve: {
      attempts: serveAttempts,
      aces: c('ACE'),
      errors: c('SERVICE_ERROR'),
      aceRate,
      errorRate: serveErrorRate,
      positiveRate: servePositiveRate,
    },
    attack: {
      attempts: attackAttempts,
      kills: c('KILL'),
      errors: c('ATTACK_ERROR'),
      killRate,
      hittingPct,
    },
    blocking: {
      soloBlocks,
      blockAssists,
      totalBlocks,
      blocksPerSet,
    },
    setsPlayed,
  };
}

export async function getMatchAdvanced(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { matchId: req.params.matchId },
      select: { eventType: true, setNumber: true },
    });
    res.json(buildAdvancedMetrics(events));
  } catch (err) {
    next(err);
  }
}

export async function getTeamAdvanced(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: { match: { teamId: req.params.teamId } },
      select: { eventType: true, setNumber: true },
    });
    res.json(buildAdvancedMetrics(events));
  } catch (err) {
    next(err);
  }
}

// Phase 4 Sprint 4 — Rotation Analytics
const VALID_ROTATION_FILTER = { gte: 1, lte: 6 } as const;

function buildRotationStats(events: { rotationNumber: number | null; eventType: string }[]) {
  const rotations: Record<number, { won: number; lost: number }> = {};
  for (let r = 1; r <= 6; r++) rotations[r] = { won: 0, lost: 0 };

  for (const e of events) {
    if (e.rotationNumber == null) continue;
    if (HOME_SCORE_EVENTS.has(e.eventType)) rotations[e.rotationNumber].won++;
    else if (AWAY_SCORE_EVENTS.has(e.eventType)) rotations[e.rotationNumber].lost++;
  }

  return Object.entries(rotations).map(([rot, { won, lost }]) => ({
    rotation: Number(rot),
    won,
    lost,
    total: won + lost,
    net: won - lost,
    efficiency: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
  }));
}

export async function getMatchRotations(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      where: {
        matchId: req.params.matchId,
        rotationNumber: VALID_ROTATION_FILTER,
        eventType: { in: [...HOME_SCORE_EVENTS, ...AWAY_SCORE_EVENTS] as any },
      },
      select: { rotationNumber: true, eventType: true },
    });

    const rotations = buildRotationStats(events);
    const withData = rotations.filter((r) => r.total > 0);

    res.json({
      rotations,
      insights: {
        best: withData.length ? withData.reduce((a, b) => (b.net > a.net ? b : a)) : null,
        worst: withData.length ? withData.reduce((a, b) => (b.net < a.net ? b : a)) : null,
        highestSideOut: withData.length ? withData.reduce((a, b) => ((b.efficiency ?? -1) > (a.efficiency ?? -1) ? b : a)) : null,
        lowestSideOut: withData.length ? withData.reduce((a, b) => ((b.efficiency ?? 101) < (a.efficiency ?? 101) ? b : a)) : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamRotations(req: Request, res: Response, next: NextFunction) {
  try {
    const { season } = req.query;
    const events = await prisma.event.findMany({
      where: {
        match: {
          teamId: req.params.teamId,
          ...(season ? { team: { season: String(season) } } : {}),
        },
        rotationNumber: VALID_ROTATION_FILTER,
        eventType: { in: [...HOME_SCORE_EVENTS, ...AWAY_SCORE_EVENTS] as any },
      },
      select: { rotationNumber: true, eventType: true },
    });

    const rotations = buildRotationStats(events);
    const withData = rotations.filter((r) => r.total > 0);

    res.json({
      rotations,
      insights: {
        best: withData.length ? withData.reduce((a, b) => (b.net > a.net ? b : a)) : null,
        worst: withData.length ? withData.reduce((a, b) => (b.net < a.net ? b : a)) : null,
        highestSideOut: withData.length ? withData.reduce((a, b) => ((b.efficiency ?? -1) > (a.efficiency ?? -1) ? b : a)) : null,
        lowestSideOut: withData.length ? withData.reduce((a, b) => ((b.efficiency ?? 101) < (a.efficiency ?? 101) ? b : a)) : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Phase 4 Sprint 3 — Momentum Analytics
// Derives scoring sequence from events (no extra DB columns needed).
// HOME scoring events: KILL, ACE, SOLO_BLOCK, BLOCK_ASSIST
// AWAY scoring events: ATTACK_ERROR, SERVICE_ERROR
const HOME_SCORE_EVENTS = new Set(['KILL', 'ACE', 'SOLO_BLOCK', 'BLOCK_ASSIST']);
const AWAY_SCORE_EVENTS = new Set(['ATTACK_ERROR', 'SERVICE_ERROR']);

export async function getMatchMomentum(req: Request, res: Response, next: NextFunction) {
  try {
    const { matchId } = req.params;

    const events = await prisma.event.findMany({
      where: {
        matchId,
        eventType: { in: [...HOME_SCORE_EVENTS, ...AWAY_SCORE_EVENTS] as any },
      },
      select: { eventType: true, setNumber: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });

    // Build point-by-point timeline
    let homeScore = 0;
    let awayScore = 0;
    let currentRunTeam: 'home' | 'away' | null = null;
    let currentRunLength = 0;
    let longestHomeRun = 0;
    let longestAwayRun = 0;
    let leadChanges = 0;
    let largestHomeLead = 0;
    let largestAwayLead = 0;
    let prevLead = 0; // positive = home, negative = away

    const timeline: {
      pointNumber: number;
      scorer: 'home' | 'away';
      homeScore: number;
      awayScore: number;
      lead: number;
      setNumber: number;
      runLength: number;
    }[] = [];

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const scorer = HOME_SCORE_EVENTS.has(e.eventType) ? 'home' : 'away';

      if (scorer === 'home') homeScore++;
      else awayScore++;

      // Track runs
      if (scorer === currentRunTeam) {
        currentRunLength++;
      } else {
        currentRunTeam = scorer;
        currentRunLength = 1;
      }
      if (scorer === 'home') longestHomeRun = Math.max(longestHomeRun, currentRunLength);
      else longestAwayRun = Math.max(longestAwayRun, currentRunLength);

      const lead = homeScore - awayScore;

      // Lead changes: sign flips (excluding 0→positive or 0→negative on first points)
      if (prevLead !== 0 && Math.sign(lead) !== Math.sign(prevLead)) leadChanges++;

      largestHomeLead = Math.max(largestHomeLead, lead);
      largestAwayLead = Math.max(largestAwayLead, -lead);
      prevLead = lead;

      timeline.push({
        pointNumber: i + 1,
        scorer,
        homeScore,
        awayScore,
        lead,
        setNumber: e.setNumber,
        runLength: currentRunLength,
      });
    }

    // Identify scoring runs for the summary (consecutive segments ≥ 3)
    const runs: { team: 'home' | 'away'; length: number; startPoint: number }[] = [];
    let runStart = 0;
    for (let i = 0; i < timeline.length; i++) {
      if (i === 0 || timeline[i].scorer !== timeline[i - 1].scorer) runStart = i;
      if (timeline[i].runLength >= 3) {
        const existing = runs.find((r) => r.startPoint === runStart);
        if (!existing) {
          runs.push({ team: timeline[i].scorer, length: timeline[i].runLength, startPoint: runStart + 1 });
        } else {
          existing.length = timeline[i].runLength;
        }
      }
    }

    res.json({
      timeline,
      stats: {
        totalPoints: events.length,
        longestHomeRun,
        longestAwayRun,
        longestRun: Math.max(longestHomeRun, longestAwayRun),
        leadChanges,
        largestHomeLead,
        largestAwayLead,
      },
      significantRuns: runs.filter((r) => r.length >= 3).slice(0, 10),
    });
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
