/**
 * League Rankings & Leaderboards — Sprint 5
 *
 * All rankings are computed exclusively from LeagueMatch fixtures that have a
 * linked, COMPLETED match on either/both sides. Friendlies and other-competition
 * matches are never included, even if those matches belong to the same team.
 *
 * Opponent-tagged events (isOpponentEvent=true) are excluded from every
 * aggregation — league leaderboards rank our own tracked players only.
 *
 * Minimum sample sizes (chosen to match the discipline in coachingRecommendations):
 *   Team rankings   — 2 completed league matches (enough for relative comparison)
 *   Player killers  — 10 attack attempts        (same threshold used in team attack)
 *   Player servers  — 10 serve attempts         (guards 1-ace-from-1-serve outliers)
 *   Player blockers — 1 completed league match of events (blocks are rare; lower bar)
 *   Player defenders— 1 completed league match of events (digs are rare; lower bar)
 *   Player setters  — 10 setting events         (assists are plentiful; filter noise)
 */

import { calculateStats, calculatePlayerStats } from '../lib/analytics';
import type { AnalyticsEvent, AnalyticsPlayer } from '../lib/analytics';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface LeagueMatchEventSet {
  /** The LeagueTeam whose side this match was linked to */
  leagueTeamId: string;
  teamId: string;
  events: AnalyticsEvent[];
  players: AnalyticsPlayer[];
}

export interface SeasonMatchData {
  /** All linked-and-completed match event sets across the season */
  matchSets: LeagueMatchEventSet[];
  /** All LeagueTeam stubs present in the season (for name lookup) */
  leagueTeams: Array<{ id: string; teamId: string; team: { name: string } }>;
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface TeamRankingEntry {
  leagueTeamId: string;
  teamName: string;
  value: number;
  matchesPlayed: number;
}

export interface PlayerLeaderboardEntry {
  playerId: string;
  playerName: string;
  teamName: string;
  value: number;
}

export interface LeagueRankings {
  teamRankings: {
    /** Ranked by hitting percentage, desc. Min 2 matches + 10 attack attempts. */
    attackEfficiency: TeamRankingEntry[];
    /** Ranked by serve-in percentage, desc. Min 2 matches + 5 serve attempts. */
    serveEfficiency: TeamRankingEntry[];
    /** Ranked by total blocks (solo + assist×0.5), desc. Min 2 matches. */
    blocking: TeamRankingEntry[];
    /** Ranked by total digs, desc. Min 2 matches. */
    defense: TeamRankingEntry[];
  };
  playerLeaderboards: {
    /** Top killers — kills desc. Min 10 attack attempts. */
    kills: PlayerLeaderboardEntry[];
    /** Top servers — aces desc. Min 10 serve attempts. */
    aces: PlayerLeaderboardEntry[];
    /** Top blockers — total blocks desc. Min 1 block event. */
    blocks: PlayerLeaderboardEntry[];
    /** Top defenders — digs desc. Min 1 dig event. */
    digs: PlayerLeaderboardEntry[];
    /** Top setters — assists desc. Min 10 setting events. */
    assists: PlayerLeaderboardEntry[];
  };
}

// ─── Internal aggregation helpers ────────────────────────────────────────────

/** Group all event sets by leagueTeamId, counting how many matches contributed. */
function groupByTeam(matchSets: LeagueMatchEventSet[]): Map<string, { events: AnalyticsEvent[]; players: AnalyticsPlayer[]; matchCount: number }> {
  const map = new Map<string, { events: AnalyticsEvent[]; players: AnalyticsPlayer[]; matchCount: number }>();
  for (const ms of matchSets) {
    const existing = map.get(ms.leagueTeamId);
    if (existing) {
      existing.events.push(...ms.events);
      // Merge players (dedupe by id)
      for (const p of ms.players) {
        if (!existing.players.find((ep) => ep.id === p.id)) existing.players.push(p);
      }
      existing.matchCount++;
    } else {
      map.set(ms.leagueTeamId, { events: [...ms.events], players: [...ms.players], matchCount: 1 });
    }
  }
  return map;
}

// ─── Public function ─────────────────────────────────────────────────────────

export function computeLeagueRankings(data: SeasonMatchData): LeagueRankings {
  const teamNameById = new Map(data.leagueTeams.map((lt) => [lt.id, lt.team.name]));
  const grouped = groupByTeam(data.matchSets);

  // ── Team rankings ──────────────────────────────────────────────────────────

  const attackEfficiency: TeamRankingEntry[] = [];
  const serveEfficiency:  TeamRankingEntry[] = [];
  const blocking:         TeamRankingEntry[] = [];
  const defense:          TeamRankingEntry[] = [];

  for (const [leagueTeamId, { events, matchCount }] of grouped) {
    if (matchCount < 2) continue; // minimum sample gate

    const teamName = teamNameById.get(leagueTeamId) ?? leagueTeamId;
    const ownEvents = events.filter((e) => !('isOpponentEvent' in e && (e as any).isOpponentEvent));
    const stats = calculateStats(ownEvents);

    if (stats.attackAttempts >= 10 && stats.hittingPercentage !== null) {
      attackEfficiency.push({ leagueTeamId, teamName, value: stats.hittingPercentage, matchesPlayed: matchCount });
    }
    if (stats.serveAttempts >= 5 && stats.serveInPercentage !== null) {
      serveEfficiency.push({ leagueTeamId, teamName, value: stats.serveInPercentage, matchesPlayed: matchCount });
    }
    blocking.push({ leagueTeamId, teamName, value: stats.totalBlocks, matchesPlayed: matchCount });
    defense.push({ leagueTeamId, teamName, value: stats.digs, matchesPlayed: matchCount });
  }

  attackEfficiency.sort((a, b) => b.value - a.value || a.teamName.localeCompare(b.teamName));
  serveEfficiency.sort((a, b) => b.value - a.value || a.teamName.localeCompare(b.teamName));
  blocking.sort((a, b) => b.value - a.value || a.teamName.localeCompare(b.teamName));
  defense.sort((a, b) => b.value - a.value || a.teamName.localeCompare(b.teamName));

  // ── Player leaderboards ────────────────────────────────────────────────────

  // Gather per-player stats across all teams.
  // We accumulate a flat map: playerId → { stats, playerName, teamName }
  const playerKills   = new Map<string, { value: number; playerName: string; teamName: string; attackAttempts: number }>();
  const playerAces    = new Map<string, { value: number; playerName: string; teamName: string; serveAttempts: number }>();
  const playerBlocks  = new Map<string, { value: number; playerName: string; teamName: string }>();
  const playerDigs    = new Map<string, { value: number; playerName: string; teamName: string }>();
  const playerAssists = new Map<string, { value: number; playerName: string; teamName: string; settingEvents: number }>();

  for (const [leagueTeamId, { events, players }] of grouped) {
    const teamName = teamNameById.get(leagueTeamId) ?? leagueTeamId;
    const ownEvents = events.filter((e) => !('isOpponentEvent' in e && (e as any).isOpponentEvent));
    const playerStatLines = calculatePlayerStats(players, ownEvents);

    for (const psl of playerStatLines) {
      const playerId = psl.player.id;
      const playerName = `${psl.player.firstName} ${psl.player.lastName}`.trim();

      // Accumulate across multiple matches (calculatePlayerStats already sums within a set)
      const prevKills = playerKills.get(playerId);
      playerKills.set(playerId, {
        value: (prevKills?.value ?? 0) + psl.kills,
        attackAttempts: (prevKills?.attackAttempts ?? 0) + psl.attackAttempts,
        playerName, teamName,
      });

      const prevAces = playerAces.get(playerId);
      playerAces.set(playerId, {
        value: (prevAces?.value ?? 0) + psl.aces,
        serveAttempts: (prevAces?.serveAttempts ?? 0) + psl.serveAttempts,
        playerName, teamName,
      });

      const prevBlocks = playerBlocks.get(playerId);
      playerBlocks.set(playerId, {
        value: (prevBlocks?.value ?? 0) + psl.totalBlocks,
        playerName, teamName,
      });

      const prevDigs = playerDigs.get(playerId);
      playerDigs.set(playerId, {
        value: (prevDigs?.value ?? 0) + psl.digs,
        playerName, teamName,
      });

      const settingEvents = psl.assists + psl.settingErrors;
      const prevAssists = playerAssists.get(playerId);
      playerAssists.set(playerId, {
        value: (prevAssists?.value ?? 0) + psl.assists,
        settingEvents: (prevAssists?.settingEvents ?? 0) + settingEvents,
        playerName, teamName,
      });
    }
  }

  function toEntries<T extends { value: number; playerName: string; teamName: string }>(
    map: Map<string, T>,
    filter: (v: T) => boolean,
  ): PlayerLeaderboardEntry[] {
    return [...map.entries()]
      .filter(([, v]) => filter(v))
      .map(([playerId, v]) => ({ playerId, playerName: v.playerName, teamName: v.teamName, value: v.value }))
      .sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName));
  }

  return {
    teamRankings: { attackEfficiency, serveEfficiency, blocking, defense },
    playerLeaderboards: {
      kills:   toEntries(playerKills,   (v) => v.attackAttempts >= 10),
      aces:    toEntries(playerAces,    (v) => v.serveAttempts  >= 10),
      blocks:  toEntries(playerBlocks,  (v) => v.value > 0),
      digs:    toEntries(playerDigs,    (v) => v.value > 0),
      assists: toEntries(playerAssists, (v) => v.settingEvents  >= 10),
    },
  };
}
