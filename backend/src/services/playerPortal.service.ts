import { prisma } from '../lib/prisma';
import { EventType } from '@prisma/client';

// Reuses the same stat derivation logic as the existing analytics engine
function deriveStats(events: { eventType: EventType }[]) {
  let kills = 0, attackAttempts = 0, attackErrors = 0;
  let aces = 0, serviceErrors = 0, serveIn = 0;
  let passAttempts = 0, passSum = 0;
  let soloBlocks = 0, blockAssists = 0, blockErrors = 0;
  let digs = 0, digErrors = 0;
  let assists = 0, settingErrors = 0;

  for (const e of events) {
    switch (e.eventType) {
      case EventType.KILL:           kills++;          attackAttempts++; break;
      case EventType.ATTACK_ERROR:   attackErrors++;   attackAttempts++; break;
      case EventType.ATTACK_ATTEMPT: attackAttempts++; break;
      case EventType.ACE:            aces++;           serveIn++;        break;
      case EventType.SERVICE_ERROR:  serviceErrors++;  break;
      case EventType.SERVE_IN:       serveIn++;        break;
      case EventType.PASS_3:         passAttempts++;   passSum += 3;     break;
      case EventType.PASS_2:         passAttempts++;   passSum += 2;     break;
      case EventType.PASS_1:         passAttempts++;   passSum += 1;     break;
      case EventType.PASS_0:         passAttempts++;                     break;
      case EventType.SOLO_BLOCK:     soloBlocks++;                       break;
      case EventType.BLOCK_ASSIST:   blockAssists++;                     break;
      case EventType.BLOCK_ERROR:    blockErrors++;                      break;
      case EventType.DIG:            digs++;                             break;
      case EventType.DIG_ERROR:      digErrors++;                        break;
      case EventType.ASSIST:         assists++;                          break;
      case EventType.SETTING_ERROR:  settingErrors++;                    break;
    }
  }

  const hittingPercentage =
    attackAttempts > 0 ? (kills - attackErrors) / attackAttempts : null;
  const passingRating = passAttempts > 0 ? passSum / passAttempts : null;
  const totalBlocks = soloBlocks + blockAssists * 0.5;
  const serveAttempts = aces + serviceErrors + serveIn;
  const serveInPercentage = serveAttempts > 0 ? serveIn / serveAttempts : null;

  return {
    kills, attackAttempts, attackErrors, hittingPercentage,
    aces, serviceErrors, serveAttempts, serveInPercentage,
    passAttempts, passingRating,
    soloBlocks, blockAssists, blockErrors, totalBlocks,
    digs, digErrors,
    assists, settingErrors,
    totalEvents: events.length,
  };
}

export async function getLinkedPlayers(userId: string) {
  return prisma.player.findMany({
    where: { userId },
    include: {
      team: { select: { id: true, name: true, division: true, season: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function linkPlayerToUser(playerId: string, userId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw Object.assign(new Error('Player not found'), { statusCode: 404 });
  return prisma.player.update({ where: { id: playerId }, data: { userId } });
}

export async function unlinkPlayer(playerId: string, userId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw Object.assign(new Error('Player not found'), { statusCode: 404 });
  if (player.userId !== userId) throw Object.assign(new Error('This player record is not linked to your account'), { statusCode: 403 });
  return prisma.player.update({ where: { id: playerId }, data: { userId: null } });
}

export async function getPlayerCareerStats(userId: string) {
  const players = await prisma.player.findMany({ where: { userId }, select: { id: true } });
  if (!players.length) return null;

  const playerIds = players.map((p) => p.id);
  const events = await prisma.event.findMany({
    where: { playerId: { in: playerIds } },
    select: { eventType: true },
  });

  return deriveStats(events);
}

export async function getPlayerRecentMatches(userId: string, limit = 5) {
  const players = await prisma.player.findMany({ where: { userId }, select: { id: true } });
  if (!players.length) return [];

  const playerIds = players.map((p) => p.id);

  // Get distinct match IDs from events for these players
  const matchEvents = await prisma.event.findMany({
    where: { playerId: { in: playerIds } },
    select: { matchId: true },
    distinct: ['matchId'],
  });

  const matchIds = matchEvents.map((e) => e.matchId);
  if (!matchIds.length) return [];

  return prisma.match.findMany({
    where: { id: { in: matchIds } },
    orderBy: { matchDate: 'desc' },
    take: limit,
    select: {
      id: true,
      matchDate: true,
      opponent: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeSetsWon: true,
      awaySetsWon: true,
      competition: true,
      team: { select: { id: true, name: true } },
    },
  });
}

export async function getDevelopmentMetrics(userId: string, matchCount = 5) {
  const players = await prisma.player.findMany({ where: { userId }, select: { id: true } });
  if (!players.length) return [];

  const playerIds = players.map((p) => p.id);

  // Get the most recent matches for these players
  const matchEvents = await prisma.event.findMany({
    where: { playerId: { in: playerIds } },
    select: { matchId: true },
    distinct: ['matchId'],
  });

  const matchIds = matchEvents.map((e) => e.matchId);
  if (!matchIds.length) return [];

  const recentMatches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    orderBy: { matchDate: 'desc' },
    take: matchCount,
    select: { id: true, opponent: true, matchDate: true },
  });

  // For each match, derive stats for these players
  const results = await Promise.all(
    recentMatches.map(async (match) => {
      const events = await prisma.event.findMany({
        where: { matchId: match.id, playerId: { in: playerIds } },
        select: { eventType: true },
      });
      return {
        matchId: match.id,
        opponent: match.opponent,
        matchDate: match.matchDate,
        ...deriveStats(events),
      };
    }),
  );

  return results.reverse(); // chronological order
}

export async function getPlayerDashboard(userId: string) {
  const [players, careerStats, recentMatches, developmentMetrics] = await Promise.all([
    getLinkedPlayers(userId),
    getPlayerCareerStats(userId),
    getPlayerRecentMatches(userId),
    getDevelopmentMetrics(userId),
  ]);

  return { players, careerStats, recentMatches, developmentMetrics };
}
