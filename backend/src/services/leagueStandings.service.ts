// ─── Input types ──────────────────────────────────────────────────────────────
//
// These mirror the shape produced by `fixtureInclude` in controllers/league.ts.
// They are kept narrow (only the fields this service actually reads) so the
// function can be tested without a database.

export interface MatchSnapshot {
  id: string;
  // In a Match record, "home" always means the *owning team* (Match.teamId),
  // "away" always means their opponent.  This is entirely independent of the
  // fixture-level home/away designation in LeagueMatch.
  homeSetsWon: number;
  awaySetsWon: number;
  status: string; // 'COMPLETED' | 'SCHEDULED' | 'IN_PROGRESS' | 'CANCELLED'
  // Live-scoring fields — present on all Match records; 0 when match hasn't started.
  homeScore?: number;
  awayScore?: number;
}

// ─── Live fixture state ────────────────────────────────────────────────────────

export interface LiveFixtureState {
  fixtureId: string;
  /** True when at least one linked match has status IN_PROGRESS. */
  isLive: boolean;
  /** Current set (1-indexed). Derived as setsWon-home + setsWon-away + 1. */
  currentSet: number;
  /** Running score in the current set — fixture home team's perspective. */
  homeSetScore: number;
  /** Running score in the current set — fixture away team's perspective. */
  awaySetScore: number;
  /** Sets won by the fixture home team so far. */
  homeSetsWon: number;
  /** Sets won by the fixture away team so far. */
  awaySetsWon: number;
  /** Which linked match is providing the live data (the IN_PROGRESS one). */
  sourceMatchId: string | null;
}

export interface LeagueTeamSnapshot {
  id: string; // LeagueTeam.id
  teamId: string;
  team: { name: string };
}

export interface FixtureSnapshot {
  id: string;
  homeLeagueTeamId: string;
  awayLeagueTeamId: string;
  homeLeagueTeam: LeagueTeamSnapshot;
  awayLeagueTeam: LeagueTeamSnapshot;
  // Linked match records — null if not yet linked by that side.
  homeMatch: MatchSnapshot | null;
  awayMatch: MatchSnapshot | null;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface StandingsRow {
  leagueTeamId: string;
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDifferential: number; // setsWon - setsLost (convenience field)
  points: number; // 2 for win, 1 for loss, 0 for unplayed
}

// Included in the per-fixture resolution detail (not in final rows, but returned
// separately so the controller can surface discrepancies if wanted in future).
export interface FixtureResult {
  fixtureId: string;
  /** null = not yet played (no complete match on either side) */
  played: boolean;
  /** Sets won by the fixture's home LeagueTeam */
  homeSetsWon: number;
  /** Sets won by the fixture's away LeagueTeam */
  awaySetsWon: number;
  /**
   * True when both sides are linked+completed and their data disagrees.
   * Home side's data is used as authoritative; no error is thrown.
   */
  hasDiscrepancy: boolean;
}

export interface StandingsResult {
  standings: StandingsRow[];
  fixtureResults: FixtureResult[];
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Resolves a single fixture into a canonical (homeSetsWon, awaySetsWon) pair.
 *
 * Translation table — how each linked match maps to fixture framing:
 *
 *   homeMatch.homeSetsWon  → fixture home team's sets  (home team owns this Match)
 *   homeMatch.awaySetsWon  → fixture away team's sets  (opponent from home team's POV)
 *
 *   awayMatch.homeSetsWon  → fixture AWAY team's sets  (away team owns this Match, they are
 *                            the "home" in their own record)
 *   awayMatch.awaySetsWon  → fixture HOME team's sets  (opponent from away team's POV)
 */
/**
 * Exported alias — use this from outside the module (fixtures page, results page, etc.)
 * instead of re-implementing the home/away translation logic.
 */
export function resolveFixtureResult(fixture: FixtureSnapshot): FixtureResult {
  return resolveFixture(fixture);
}

/**
 * Live sibling of resolveFixtureResult — applies the same home/away translation logic
 * but reads from whichever linked match has status IN_PROGRESS.
 *
 * Translation table (identical to resolveFixture):
 *   homeMatch.homeScore    → fixture home team's current set score
 *   homeMatch.awayScore    → fixture away team's current set score
 *   homeMatch.homeSetsWon  → fixture home team's sets won
 *   homeMatch.awaySetsWon  → fixture away team's sets won
 *
 *   awayMatch.homeScore    → fixture AWAY team's current set score (they own this Match)
 *   awayMatch.awayScore    → fixture HOME team's current set score
 *   awayMatch.homeSetsWon  → fixture away team's sets won
 *   awayMatch.awaySetsWon  → fixture home team's sets won
 *
 * When both sides are IN_PROGRESS (shouldn't happen in practice), home side is authoritative.
 * Returns isLive=false when no linked match is IN_PROGRESS.
 */
export function resolveLiveFixtureState(fixture: FixtureSnapshot): LiveFixtureState {
  const { homeMatch, awayMatch } = fixture;
  const homeLive = homeMatch?.status === 'IN_PROGRESS';
  const awayLive = awayMatch?.status === 'IN_PROGRESS';

  if (!homeLive && !awayLive) {
    return {
      fixtureId: fixture.id,
      isLive: false,
      currentSet: 0,
      homeSetScore: 0,
      awaySetScore: 0,
      homeSetsWon: 0,
      awaySetsWon: 0,
      sourceMatchId: null,
    };
  }

  // Prefer home match when both somehow report IN_PROGRESS.
  const live = homeLive ? homeMatch! : awayMatch!;
  const isHomeMatch = homeLive;

  // Apply same translation as resolveFixture: away team's Match has inverted perspective.
  const homeSetScore   = isHomeMatch ? (live.homeScore ?? 0) : (live.awayScore  ?? 0);
  const awaySetScore   = isHomeMatch ? (live.awayScore  ?? 0) : (live.homeScore ?? 0);
  const homeSetsWon    = isHomeMatch ? live.homeSetsWon : live.awaySetsWon;
  const awaySetsWon    = isHomeMatch ? live.awaySetsWon : live.homeSetsWon;
  const currentSet     = homeSetsWon + awaySetsWon + 1;

  return {
    fixtureId: fixture.id,
    isLive: true,
    currentSet,
    homeSetScore,
    awaySetScore,
    homeSetsWon,
    awaySetsWon,
    sourceMatchId: live.id,
  };
}

function resolveFixture(fixture: FixtureSnapshot): FixtureResult {
  const { homeMatch, awayMatch } = fixture;

  const homeCompleted = homeMatch?.status === 'COMPLETED';
  const awayCompleted = awayMatch?.status === 'COMPLETED';

  // No completed data on either side → not yet played.
  if (!homeCompleted && !awayCompleted) {
    return { fixtureId: fixture.id, played: false, homeSetsWon: 0, awaySetsWon: 0, hasDiscrepancy: false };
  }

  // Translate each side into fixture framing.
  const fromHome = homeCompleted
    ? { home: homeMatch!.homeSetsWon, away: homeMatch!.awaySetsWon }
    : null;

  // Away team's Match record: their "home" = fixture's away team; their "away" = fixture's home team.
  const fromAway = awayCompleted
    ? { home: awayMatch!.awaySetsWon, away: awayMatch!.homeSetsWon }
    : null;

  if (fromHome && fromAway) {
    const disagree = fromHome.home !== fromAway.home || fromHome.away !== fromAway.away;
    // Home side is authoritative when both are present.
    return {
      fixtureId: fixture.id,
      played: true,
      homeSetsWon: fromHome.home,
      awaySetsWon: fromHome.away,
      hasDiscrepancy: disagree,
    };
  }

  // Exactly one side linked.
  const source = fromHome ?? fromAway!;
  return { fixtureId: fixture.id, played: true, homeSetsWon: source.home, awaySetsWon: source.away, hasDiscrepancy: false };
}

/**
 * Computes a league season's standings table from the provided fixtures and teams.
 *
 * @param leagueTeams  All LeagueTeam entries for the season.
 * @param fixtures     All LeagueMatch fixtures for the season (with homeMatch/awayMatch included).
 * @returns Sorted standings rows and per-fixture resolution details.
 */
export function computeStandings(
  leagueTeams: LeagueTeamSnapshot[],
  fixtures: FixtureSnapshot[],
): StandingsResult {
  // Initialise every team's row — ensures teams with no fixtures still appear.
  const rows = new Map<string, StandingsRow>(
    leagueTeams.map((lt) => [
      lt.id,
      {
        leagueTeamId: lt.id,
        teamId: lt.teamId,
        teamName: lt.team.name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        setDifferential: 0,
        points: 0,
      },
    ]),
  );

  const fixtureResults: FixtureResult[] = [];

  for (const fixture of fixtures) {
    const result = resolveFixture(fixture);
    fixtureResults.push(result);

    if (!result.played) continue;

    const home = rows.get(fixture.homeLeagueTeamId);
    const away = rows.get(fixture.awayLeagueTeamId);

    // Guard: skip if a LeagueTeam referenced by the fixture is not in our leagueTeams list.
    if (!home || !away) continue;

    const homeWon = result.homeSetsWon > result.awaySetsWon;

    // Home team
    home.matchesPlayed += 1;
    home.setsWon += result.homeSetsWon;
    home.setsLost += result.awaySetsWon;
    home.wins += homeWon ? 1 : 0;
    home.losses += homeWon ? 0 : 1;
    home.points += homeWon ? 2 : 1;
    home.setDifferential = home.setsWon - home.setsLost;

    // Away team
    away.matchesPlayed += 1;
    away.setsWon += result.awaySetsWon;
    away.setsLost += result.homeSetsWon;
    away.wins += homeWon ? 0 : 1;
    away.losses += homeWon ? 1 : 0;
    away.points += homeWon ? 1 : 2;
    away.setDifferential = away.setsWon - away.setsLost;
  }

  const standings = [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;                  // most points first
    if (b.setDifferential !== a.setDifferential) return b.setDifferential - a.setDifferential; // best differential
    return a.teamName.localeCompare(b.teamName);                            // alphabetical tiebreak
  });

  return { standings, fixtureResults };
}
