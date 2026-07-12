import { resolveFixtureResult } from './leagueStandings.service';
import type { FixtureSnapshot, LeagueTeamSnapshot, StandingsRow } from './leagueStandings.service';

// ─── Extended fixture type (adds scheduledDate, needed for profile) ────────────

export interface FixtureWithDate extends FixtureSnapshot {
  scheduledDate: string | Date;
}

// ─── Private intel types ──────────────────────────────────────────────────────

export interface MatchRef {
  matchId: string;
  matchDate: string;
  opponent: string;
  /** URL to the structured report — caller fetches this separately */
  reportUrl: string;
  /** URL to the AI narrative — caller fetches this separately */
  narrativeUrl: string;
}

/**
 * Present in the profile ONLY when the requester has MANAGE_TEAM on the
 * underlying Team. Completely absent (not null, not empty) otherwise —
 * so there is no signal to an opposing coach that this section exists.
 */
export interface PrivateIntel {
  heatmapUrl: string;
  recentMatchReports: MatchRef[];
}

// ─── Public profile types ─────────────────────────────────────────────────────

export interface RecentResult {
  fixtureId: string;
  scheduledDate: string;
  opponentName: string;
  result: 'W' | 'L';
  homeSetsWon: number; // fixture-framing (after resolveFixtureResult translation)
  awaySetsWon: number;
  isHome: boolean;     // whether this team was the home side in the fixture
  hasDiscrepancy: boolean;
}

export interface UpcomingFixture {
  fixtureId: string;
  scheduledDate: string;
  opponentName: string;
  isHome: boolean;
}

export interface LeagueTeamProfile {
  leagueTeamId: string;
  teamId: string;
  teamName: string;
  division: string | null;
  season: string;
  /** Null when the season has no completed fixtures yet. */
  standing: StandingsRow | null;
  /** Win/loss sequence for all completed fixtures, oldest → newest. */
  winLossTrend: ('W' | 'L')[];
  /** Last 5 completed fixtures, newest first. */
  recentResults: RecentResult[];
  /** All upcoming (unplayed, future-dated) fixtures for this team. */
  upcomingFixtures: UpcomingFixture[];
  privateIntel?: PrivateIntel;
}

// ─── Input type for the team's own Match records ──────────────────────────────

export interface OwnMatchSnapshot {
  matchId: string;
  matchDate: string | Date;
  opponent: string;
}

// ─── Assembly function ────────────────────────────────────────────────────────

/**
 * Assembles a league team's public profile plus, conditionally, its private
 * coaching intelligence section.
 *
 * Privacy rule: `privateIntel` is set when `canViewPrivateIntel` is true and
 * omitted entirely (not null, not an empty object) when false. The caller
 * (the controller) is responsible for setting `canViewPrivateIntel` by
 * calling `hasTeamPermission(userId, teamId, Permission.MANAGE_TEAM)`.
 *
 * @param leagueTeam          The LeagueTeam entry for the team being profiled.
 * @param allSeasonFixtures   All LeagueMatch fixtures for this season (with
 *                            homeMatch/awayMatch included).
 * @param standingRow         This team's row from computeStandings, or null if
 *                            the season has no completed fixtures.
 * @param ownMatches          The team's own Match records (from the matches
 *                            table), used to build the private intel URLs.
 *                            Pass [] when canViewPrivateIntel is false —
 *                            the function ignores them in that case.
 * @param canViewPrivateIntel Derived from hasTeamPermission(MANAGE_TEAM).
 */
export function assembleLeagueTeamProfile(
  leagueTeam: LeagueTeamSnapshot & { team: { name: string; division: string | null; season: string } },
  allSeasonFixtures: FixtureWithDate[],
  standingRow: StandingsRow | null,
  ownMatches: OwnMatchSnapshot[],
  canViewPrivateIntel: boolean,
): LeagueTeamProfile {
  const now = new Date();
  const myId = leagueTeam.id;

  // ── Filter to fixtures involving this LeagueTeam ──────────────────────────
  const myFixtures = allSeasonFixtures.filter(
    (f) => f.homeLeagueTeamId === myId || f.awayLeagueTeamId === myId,
  );

  // ── Resolve each fixture and classify ─────────────────────────────────────
  const completed: Array<{ f: FixtureWithDate; r: ReturnType<typeof resolveFixtureResult>; isHome: boolean }> = [];
  const upcoming: UpcomingFixture[] = [];

  for (const f of myFixtures) {
    const isHome = f.homeLeagueTeamId === myId;
    const opponent = isHome
      ? f.awayLeagueTeam.team.name
      : f.homeLeagueTeam.team.name;
    const scheduledDate = new Date(f.scheduledDate);
    const result = resolveFixtureResult(f);

    if (result.played) {
      completed.push({ f, r: result, isHome });
    } else if (scheduledDate > now) {
      upcoming.push({
        fixtureId: f.id,
        scheduledDate: scheduledDate.toISOString(),
        opponentName: opponent,
        isHome,
      });
    }
    // pending (past date, not yet resolved) — not shown in upcoming, not shown in results
  }

  // ── Sort completed: oldest → newest for trend, newest → oldest for recent ─
  completed.sort((a, b) => new Date(a.f.scheduledDate).getTime() - new Date(b.f.scheduledDate).getTime());

  // ── Win/loss trend (all completed, oldest → newest) ───────────────────────
  const winLossTrend: ('W' | 'L')[] = completed.map(({ r, isHome }) => {
    const iWon = isHome
      ? r.homeSetsWon > r.awaySetsWon
      : r.awaySetsWon > r.homeSetsWon;
    return iWon ? 'W' : 'L';
  });

  // ── Recent results (last 5, newest first) ─────────────────────────────────
  const recentResults: RecentResult[] = [...completed]
    .reverse()
    .slice(0, 5)
    .map(({ f, r, isHome }) => {
      const iWon = isHome
        ? r.homeSetsWon > r.awaySetsWon
        : r.awaySetsWon > r.homeSetsWon;
      const opponent = isHome
        ? f.awayLeagueTeam.team.name
        : f.homeLeagueTeam.team.name;
      return {
        fixtureId: f.id,
        scheduledDate: new Date(f.scheduledDate).toISOString(),
        opponentName: opponent,
        result: iWon ? 'W' : 'L',
        homeSetsWon: r.homeSetsWon,
        awaySetsWon: r.awaySetsWon,
        isHome,
        hasDiscrepancy: r.hasDiscrepancy,
      };
    });

  // ── Sort upcoming chronologically ─────────────────────────────────────────
  upcoming.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  // ── Private intel — ONLY when requester has MANAGE_TEAM ───────────────────
  // This is the privacy gate. `canViewPrivateIntel` is set by the controller
  // via hasTeamPermission(userId, team.id, Permission.MANAGE_TEAM).
  // When false, the `privateIntel` key is absent from the returned object —
  // no null, no empty shape, no signal that the section exists.
  const privateIntel: PrivateIntel | undefined = canViewPrivateIntel
    ? {
        heatmapUrl: `/api/v1/analytics/teams/${leagueTeam.teamId}/heatmap`,
        recentMatchReports: ownMatches.slice(0, 5).map((m) => ({
          matchId: m.matchId,
          matchDate: new Date(m.matchDate).toISOString(),
          opponent: m.opponent,
          reportUrl:    `/api/v1/analytics/matches/${m.matchId}/report`,
          narrativeUrl: `/api/v1/analytics/matches/${m.matchId}/report/narrative`,
        })),
      }
    : undefined;

  return {
    leagueTeamId: leagueTeam.id,
    teamId: leagueTeam.teamId,
    teamName: leagueTeam.team.name,
    division: leagueTeam.team.division,
    season: leagueTeam.team.season,
    standing: standingRow,
    winLossTrend,
    recentResults,
    upcomingFixtures: upcoming,
    ...(privateIntel !== undefined ? { privateIntel } : {}),
  };
}
