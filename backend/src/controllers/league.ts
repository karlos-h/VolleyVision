import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { hasTeamPermission, Permission } from '../services/permission.service';
import { computeStandings, resolveFixtureResult } from '../services/leagueStandings.service';
import { assembleLeagueTeamProfile } from '../services/leagueTeamProfile.service';
import { computeLeagueRankings } from '../services/leagueRankings.service';
import type { LeagueMatchEventSet } from '../services/leagueRankings.service';

// ─── Shared include shapes ────────────────────────────────────────────────────

const leagueTeamInclude = {
  team: { select: { id: true, name: true, division: true, season: true } },
} as const;

const fixtureInclude = {
  homeLeagueTeam: { include: leagueTeamInclude },
  awayLeagueTeam: { include: leagueTeamInclude },
  homeMatch: { select: { id: true, matchDate: true, homeScore: true, awayScore: true, homeSetsWon: true, awaySetsWon: true, status: true } },
  awayMatch:  { select: { id: true, matchDate: true, homeScore: true, awayScore: true, homeSetsWon: true, awaySetsWon: true, status: true } },
} as const;

// ─── League CRUD ─────────────────────────────────────────────────────────────

export async function createLeague(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, division } = req.body;
    if (!name) throw new AppError(400, 'name is required.');
    const league = await prisma.league.create({
      data: { name, division: division ?? null, createdByUserId: req.user!.userId },
    });
    res.status(201).json(league);
  } catch (err) { next(err); }
}

export async function listLeagues(req: Request, res: Response, next: NextFunction) {
  try {
    // Public endpoint: list all leagues with their seasons and team counts.
    const leagues = await prisma.league.findMany({
      include: {
        seasons: {
          include: { _count: { select: { teams: true, fixtures: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(leagues);
  } catch (err) { next(err); }
}

export async function getLeague(req: Request, res: Response, next: NextFunction) {
  try {
    const league = await prisma.league.findUnique({
      where: { id: req.params.leagueId },
      include: {
        seasons: {
          include: { _count: { select: { teams: true, fixtures: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!league) throw new AppError(404, 'League not found.');
    res.json(league);
  } catch (err) { next(err); }
}

// ─── Season CRUD ──────────────────────────────────────────────────────────────

export async function createSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate) throw new AppError(400, 'name and startDate are required.');
    const league = await prisma.league.findUnique({ where: { id: req.params.leagueId }, select: { id: true } });
    if (!league) throw new AppError(404, 'League not found.');
    const season = await prisma.leagueSeason.create({
      data: {
        leagueId: league.id,
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json(season);
  } catch (err) { next(err); }
}

export async function getSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const season = await prisma.leagueSeason.findUnique({
      where: { id: req.params.seasonId },
      include: {
        league: { select: { id: true, name: true, division: true } },
        teams: { include: leagueTeamInclude, orderBy: { joinedAt: 'asc' } },
        _count: { select: { fixtures: true } },
      },
    });
    if (!season) throw new AppError(404, 'Season not found.');
    res.json(season);
  } catch (err) { next(err); }
}

// ─── LeagueTeam — join a season ───────────────────────────────────────────────

export async function addTeamToSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId } = req.params;
    const { teamId } = req.body;
    if (!teamId) throw new AppError(400, 'teamId is required.');

    // Permission: requester must have MANAGE_TEAM on the team being added.
    const allowed = await hasTeamPermission(req.user!.userId, teamId, Permission.MANAGE_TEAM);
    if (!allowed) throw new AppError(403, 'You do not have permission to add this team to a league.');

    const season = await prisma.leagueSeason.findUnique({ where: { id: seasonId }, select: { id: true } });
    if (!season) throw new AppError(404, 'Season not found.');

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new AppError(404, 'Team not found.');

    try {
      const leagueTeam = await prisma.leagueTeam.create({
        data: { leagueSeasonId: seasonId, teamId },
        include: leagueTeamInclude,
      });
      res.status(201).json(leagueTeam);
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError(409, 'This team is already in this season.');
      throw e;
    }
  } catch (err) { next(err); }
}

export async function removeTeamFromSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId, leagueTeamId } = req.params;
    const leagueTeam = await prisma.leagueTeam.findUnique({
      where: { id: leagueTeamId },
      select: { id: true, teamId: true, leagueSeasonId: true },
    });
    if (!leagueTeam || leagueTeam.leagueSeasonId !== seasonId) throw new AppError(404, 'League team entry not found.');

    const allowed = await hasTeamPermission(req.user!.userId, leagueTeam.teamId, Permission.MANAGE_TEAM);
    if (!allowed) throw new AppError(403, 'You do not have permission to remove this team from the league.');

    await prisma.leagueTeam.delete({ where: { id: leagueTeamId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── LeagueMatch fixtures ─────────────────────────────────────────────────────

export async function createFixture(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId } = req.params;
    const { homeLeagueTeamId, awayLeagueTeamId, scheduledDate } = req.body;
    if (!homeLeagueTeamId || !awayLeagueTeamId || !scheduledDate) {
      throw new AppError(400, 'homeLeagueTeamId, awayLeagueTeamId, and scheduledDate are required.');
    }
    if (homeLeagueTeamId === awayLeagueTeamId) {
      throw new AppError(400, 'Home and away team must be different.');
    }

    // Both LeagueTeam entries must belong to this season.
    const [homeLeagueTeam, awayLeagueTeam] = await Promise.all([
      prisma.leagueTeam.findFirst({ where: { id: homeLeagueTeamId, leagueSeasonId: seasonId }, select: { id: true, teamId: true } }),
      prisma.leagueTeam.findFirst({ where: { id: awayLeagueTeamId, leagueSeasonId: seasonId }, select: { id: true, teamId: true } }),
    ]);
    if (!homeLeagueTeam) throw new AppError(404, 'Home league team not found in this season.');
    if (!awayLeagueTeam) throw new AppError(404, 'Away league team not found in this season.');

    // Admin check is handled by requireAdmin middleware on the route.
    const fixture = await prisma.leagueMatch.create({
      data: {
        leagueSeasonId: seasonId,
        homeLeagueTeamId,
        awayLeagueTeamId,
        scheduledDate: new Date(scheduledDate),
      },
      include: fixtureInclude,
    });
    res.status(201).json(fixture);
  } catch (err) { next(err); }
}

export async function listFixtures(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId } = req.params;
    const { teamId, from, to, status } = req.query as Record<string, string | undefined>;

    // Build the Prisma where clause — only the parts that can be pushed to the DB.
    const where: Record<string, unknown> = { leagueSeasonId: seasonId };

    // teamId filter: match fixtures where either the home or away LeagueTeam's underlying
    // Team.id equals the requested teamId.
    if (teamId) {
      where.OR = [
        { homeLeagueTeam: { teamId } },
        { awayLeagueTeam: { teamId } },
      ];
    }

    // Date range filter on scheduledDate.
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to)   dateFilter.lte = new Date(to);
      where.scheduledDate = dateFilter;
    }

    // Fetch all matching fixtures (status filter is applied in JS after resolution).
    const fixtures = await prisma.leagueMatch.findMany({
      where,
      include: fixtureInclude,
      orderBy: { scheduledDate: 'asc' },
    });

    // No status filter → identical to pre-Sprint-3 behaviour.
    if (!status) {
      res.json(fixtures);
      return;
    }

    const now = new Date();

    const filtered = fixtures.filter((f) => {
      const result = resolveFixtureResult(f as any);

      if (status === 'completed') {
        return result.played;
      }

      if (status === 'upcoming') {
        // Not yet resolved AND scheduledDate is in the future.
        return !result.played && new Date(f.scheduledDate) > now;
      }

      if (status === 'pending') {
        // scheduledDate has passed but still not resolved.
        return !result.played && new Date(f.scheduledDate) <= now;
      }

      return true; // unknown status value → include everything
    });

    res.json(filtered);
  } catch (err) { next(err); }
}

export async function getFixture(req: Request, res: Response, next: NextFunction) {
  try {
    const fixture = await prisma.leagueMatch.findUnique({
      where: { id: req.params.fixtureId },
      include: fixtureInclude,
    });
    if (!fixture) throw new AppError(404, 'Fixture not found.');
    res.json(fixture);
  } catch (err) { next(err); }
}

// ─── Link / unlink a Match to a LeagueMatch ───────────────────────────────────
//
// Permission walk-through (the key security surface):
//
//   1. Requester must be authenticated (requireAuth on route).
//   2. We load the LeagueMatch to find the home/away LeagueTeam IDs.
//   3. From the body we receive `matchId` (the Match the coach wants to link) and `side` ("home"|"away").
//   4. We load that Match to get its `teamId` — the team that *owns* that match record.
//   5. We check that `teamId` equals the `teamId` of the `LeagueTeam` for the requested side.
//      → This prevents a coach from linking a match they don't own by guessing a fixture ID.
//      → It also prevents linking a match to the *wrong* side (e.g. linking a home team's match as "away").
//   6. We check hasTeamPermission(userId, teamId, MANAGE_TEAM) on that match's team.
//      → This prevents someone who can *see* a team but doesn't manage it from linking matches for it.
//
// All six checks must pass. Any one failure short-circuits with 403/404.

export async function linkMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { fixtureId } = req.params;
    const { matchId, side } = req.body as { matchId?: string; side?: string };

    if (!matchId || !side) throw new AppError(400, 'matchId and side ("home" | "away") are required.');
    if (side !== 'home' && side !== 'away') throw new AppError(400, 'side must be "home" or "away".');

    // Load fixture — need the LeagueTeam IDs to validate ownership.
    const fixture = await prisma.leagueMatch.findUnique({
      where: { id: fixtureId },
      include: {
        homeLeagueTeam: { select: { teamId: true } },
        awayLeagueTeam: { select: { teamId: true } },
      },
    });
    if (!fixture) throw new AppError(404, 'Fixture not found.');

    // Load the Match the coach wants to link.
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { teamId: true } });
    if (!match) throw new AppError(404, 'Match not found.');

    // The Match must belong to the team on the requested side of the fixture.
    const expectedTeamId = side === 'home'
      ? fixture.homeLeagueTeam.teamId
      : fixture.awayLeagueTeam.teamId;

    if (match.teamId !== expectedTeamId) {
      // Either the match belongs to a completely different team, or the coach is
      // trying to link the home team's match as "away" (or vice versa).
      throw new AppError(403, 'This match does not belong to the team on that side of the fixture.');
    }

    // Permission: requester must manage the team that owns the match.
    const allowed = await hasTeamPermission(req.user!.userId, match.teamId, Permission.MANAGE_TEAM);
    if (!allowed) throw new AppError(403, 'You do not have permission to link matches for this team.');

    const updated = await prisma.leagueMatch.update({
      where: { id: fixtureId },
      data: side === 'home' ? { homeMatchId: matchId } : { awayMatchId: matchId },
      include: fixtureInclude,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function unlinkMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { fixtureId } = req.params;
    const { side } = req.body as { side?: string };

    if (!side || (side !== 'home' && side !== 'away')) {
      throw new AppError(400, 'side must be "home" or "away".');
    }

    const fixture = await prisma.leagueMatch.findUnique({
      where: { id: fixtureId },
      include: {
        homeLeagueTeam: { select: { teamId: true } },
        awayLeagueTeam: { select: { teamId: true } },
      },
    });
    if (!fixture) throw new AppError(404, 'Fixture not found.');

    const teamId = side === 'home'
      ? fixture.homeLeagueTeam.teamId
      : fixture.awayLeagueTeam.teamId;

    const allowed = await hasTeamPermission(req.user!.userId, teamId, Permission.MANAGE_TEAM);
    if (!allowed) throw new AppError(403, 'You do not have permission to unlink matches for this team.');

    const updated = await prisma.leagueMatch.update({
      where: { id: fixtureId },
      data: side === 'home' ? { homeMatchId: null } : { awayMatchId: null },
      include: fixtureInclude,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

// ─── My leagues — filtered to seasons the user's teams are in ─────────────────

export async function listMyLeagues(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    // Get all team IDs the user has any membership in (via ownership or TeamMembership).
    const [ownedTeams, memberships] = await Promise.all([
      prisma.team.findMany({ where: { ownerId: userId }, select: { id: true } }),
      prisma.teamMembership.findMany({ where: { userId }, select: { teamId: true } }),
    ]);
    const myTeamIds = [...new Set([
      ...ownedTeams.map((t) => t.id),
      ...memberships.map((m) => m.teamId),
    ])];

    // Find seasons that contain any of these teams.
    const seasons = await prisma.leagueSeason.findMany({
      where: { teams: { some: { teamId: { in: myTeamIds } } } },
      include: {
        league: { select: { id: true, name: true, division: true } },
        teams: { include: leagueTeamInclude, orderBy: { joinedAt: 'asc' } },
        _count: { select: { fixtures: true, teams: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(seasons);
  } catch (err) { next(err); }
}

// ─── Season Standings ─────────────────────────────────────────────────────────

export async function getSeasonStandings(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId } = req.params;

    const [leagueTeams, fixtures] = await Promise.all([
      prisma.leagueTeam.findMany({
        where: { leagueSeasonId: seasonId },
        include: leagueTeamInclude,
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.leagueMatch.findMany({
        where: { leagueSeasonId: seasonId },
        include: fixtureInclude,
        orderBy: { scheduledDate: 'asc' },
      }),
    ]);

    if (!leagueTeams.length) {
      // Return empty standings rather than 404 — the season may exist but have no teams yet.
      res.json({ standings: [], fixtureResults: [] });
      return;
    }

    const result = computeStandings(leagueTeams, fixtures as any);
    res.json(result);
  } catch (err) { next(err); }
}

// ─── League Team Profile ───────────────────────────────────────────────────────

export async function getLeagueTeamProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { leagueTeamId } = req.params;

    // 1. Load the LeagueTeam with its underlying Team and the season it belongs to.
    const leagueTeam = await prisma.leagueTeam.findUnique({
      where: { id: leagueTeamId },
      include: {
        team: { select: { id: true, name: true, division: true, season: true } },
        leagueSeason: { select: { id: true } },
      },
    });
    if (!leagueTeam) throw new AppError(404, 'League team not found.');

    const seasonId = leagueTeam.leagueSeasonId;
    const teamId   = leagueTeam.teamId;

    // 2. Privacy gate — must be evaluated BEFORE any private data is loaded.
    //    `canViewPrivateIntel` is a clearly named boolean controlling the one
    //    structural branch that includes or excludes the private section.
    //    An opposing coach (or anonymous viewer) will have canViewPrivateIntel=false
    //    because hasTeamPermission checks membership/ownership on the underlying Team.
    const requesterId = req.user?.userId ?? null;
    const canViewPrivateIntel = requesterId
      ? await hasTeamPermission(requesterId, teamId, Permission.MANAGE_TEAM)
      : false;

    // 3. Load all season fixtures and season teams in parallel.
    const [allSeasonFixtures, allLeagueTeams] = await Promise.all([
      prisma.leagueMatch.findMany({
        where: { leagueSeasonId: seasonId },
        include: fixtureInclude,
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.leagueTeam.findMany({
        where: { leagueSeasonId: seasonId },
        include: leagueTeamInclude,
      }),
    ]);

    // 4. Compute season standings and extract this team's row.
    const { standings } = computeStandings(allLeagueTeams, allSeasonFixtures as any);
    const standingRow = standings.find((r) => r.leagueTeamId === leagueTeamId) ?? null;

    // 5. Load the team's own Match records ONLY when permitted — avoids any DB
    //    query for private data when the gate is closed.
    const ownMatches = canViewPrivateIntel
      ? await prisma.match.findMany({
          where: { teamId, status: 'COMPLETED' },
          select: { id: true, matchDate: true, opponent: true },
          orderBy: { matchDate: 'desc' },
          take: 5,
        })
      : [];

    // 6. Assemble the profile. The service function enforces the privacy rule:
    //    `privateIntel` is present when canViewPrivateIntel=true, absent otherwise.
    const profile = assembleLeagueTeamProfile(
      { ...leagueTeam, team: leagueTeam.team },
      allSeasonFixtures as any,
      standingRow,
      ownMatches.map((m) => ({ matchId: m.id, matchDate: m.matchDate.toISOString(), opponent: m.opponent })),
      canViewPrivateIntel,
    );

    res.json(profile);
  } catch (err) { next(err); }
}

// ─── Season Rankings & Leaderboards ──────────────────────────────────────────

// Include shape for fixtures that need full event data for rankings.
// Separated from the lightweight fixtureInclude to avoid burdening other endpoints.
const rankingsFixtureInclude = {
  homeLeagueTeam: { include: leagueTeamInclude },
  awayLeagueTeam: { include: leagueTeamInclude },
  homeMatch: {
    where: { status: 'COMPLETED' },
    select: {
      id: true, status: true,
      teamId: true,
      events: { select: { eventType: true, setNumber: true, playerId: true, isOpponentEvent: true } },
      players: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } },
    },
  },
  awayMatch: {
    where: { status: 'COMPLETED' },
    select: {
      id: true, status: true,
      teamId: true,
      events: { select: { eventType: true, setNumber: true, playerId: true, isOpponentEvent: true } },
      players: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, position: true } },
    },
  },
} as const;

export async function getSeasonRankings(req: Request, res: Response, next: NextFunction) {
  try {
    const { seasonId } = req.params;

    const [fixtures, leagueTeams] = await Promise.all([
      prisma.leagueMatch.findMany({
        where: { leagueSeasonId: seasonId },
        include: rankingsFixtureInclude as any,
      }),
      prisma.leagueTeam.findMany({
        where: { leagueSeasonId: seasonId },
        include: leagueTeamInclude,
      }),
    ]);

    // Build the match event sets — one entry per linked, completed match side.
    // A fixture can contribute 0, 1, or 2 event sets depending on what's linked.
    const matchSets: LeagueMatchEventSet[] = [];
    for (const fixture of fixtures as any[]) {
      if (fixture.homeMatch) {
        matchSets.push({
          leagueTeamId: fixture.homeLeagueTeamId,
          teamId: fixture.homeMatch.teamId,
          events: fixture.homeMatch.events,
          players: fixture.homeMatch.players,
        });
      }
      if (fixture.awayMatch) {
        matchSets.push({
          leagueTeamId: fixture.awayLeagueTeamId,
          teamId: fixture.awayMatch.teamId,
          events: fixture.awayMatch.events,
          players: fixture.awayMatch.players,
        });
      }
    }

    const rankings = computeLeagueRankings({
      matchSets,
      leagueTeams: leagueTeams.map((lt) => ({
        id: lt.id,
        teamId: lt.teamId,
        team: { name: lt.team.name },
      })),
    });

    res.json(rankings);
  } catch (err) { next(err); }
}
