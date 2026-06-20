import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assembleLeagueTeamProfile } from '../services/leagueTeamProfile.service';
import type { FixtureWithDate } from '../services/leagueTeamProfile.service';
import type { LeagueTeamSnapshot, StandingsRow } from '../services/leagueStandings.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function team(id: string, name: string, teamId = `t-${id}`): LeagueTeamSnapshot & { team: { name: string; division: string | null; season: string } } {
  return { id, teamId, team: { name, division: null, season: '2026' } };
}

function match(homeSetsWon: number, awaySetsWon: number, status = 'COMPLETED') {
  return { id: `m-${Math.random()}`, homeSetsWon, awaySetsWon, status };
}

function fixture(
  id: string,
  homeLeagueTeam: LeagueTeamSnapshot,
  awayLeagueTeam: LeagueTeamSnapshot,
  scheduledDate: string,
  homeMatch: ReturnType<typeof match> | null = null,
  awayMatch: ReturnType<typeof match> | null = null,
): FixtureWithDate {
  return {
    id,
    homeLeagueTeamId: homeLeagueTeam.id,
    awayLeagueTeamId: awayLeagueTeam.id,
    homeLeagueTeam,
    awayLeagueTeam,
    homeMatch,
    awayMatch,
    scheduledDate,
  };
}

function row(leagueTeamId: string, wins = 0, losses = 0): StandingsRow {
  return { leagueTeamId, teamId: `t-${leagueTeamId}`, teamName: leagueTeamId, matchesPlayed: wins + losses, wins, losses, setsWon: 0, setsLost: 0, setDifferential: 0, points: wins * 2 + losses };
}

const PAST   = '2026-01-01T12:00:00Z'; // well in the past
const FUTURE = '2030-01-01T12:00:00Z'; // well in the future

// ─── Privacy boundary — the single most important test in this sprint ─────────

describe('assembleLeagueTeamProfile — privacy boundary', () => {
  const alpha = team('A', 'Alpha');
  const beta  = team('B', 'Beta');

  const ownMatchRefs = [
    { matchId: 'm1', matchDate: '2026-01-01T12:00:00Z', opponent: 'Beta' },
  ];

  it('privateIntel is PRESENT (not null, not undefined) when canViewPrivateIntel is true', () => {
    const profile = assembleLeagueTeamProfile(alpha, [], row('A'), ownMatchRefs, true);

    assert.ok('privateIntel' in profile, 'privateIntel key must exist when canViewPrivateIntel=true');
    assert.ok(profile.privateIntel !== null, 'privateIntel must not be null');
    assert.ok(profile.privateIntel !== undefined, 'privateIntel must not be undefined');
  });

  it('privateIntel is ABSENT (key does not exist) when canViewPrivateIntel is false', () => {
    const profile = assembleLeagueTeamProfile(alpha, [], row('A'), ownMatchRefs, false);

    assert.ok(!('privateIntel' in profile),
      'privateIntel key must be completely absent when canViewPrivateIntel=false — ' +
      'no null, no empty object, no signal to an opposing coach that this section exists');
  });

  it('heatmapUrl contains the correct teamId when intel is present', () => {
    const profile = assembleLeagueTeamProfile(alpha, [], row('A'), ownMatchRefs, true);

    assert.ok(profile.privateIntel!.heatmapUrl.includes(alpha.teamId),
      'heatmapUrl must reference the correct team');
    assert.equal(profile.privateIntel!.heatmapUrl, `/api/v1/analytics/teams/${alpha.teamId}/heatmap`);
  });

  it('recentMatchReports contain correct report and narrative URLs', () => {
    const profile = assembleLeagueTeamProfile(alpha, [], row('A'), ownMatchRefs, true);

    const ref = profile.privateIntel!.recentMatchReports[0];
    assert.equal(ref.matchId, 'm1');
    assert.equal(ref.reportUrl,    '/api/v1/analytics/matches/m1/report');
    assert.equal(ref.narrativeUrl, '/api/v1/analytics/matches/m1/report/narrative');
  });

  it('recentMatchReports is capped at 5 even when more own matches are supplied', () => {
    const manyMatches = Array.from({ length: 10 }, (_, i) => ({
      matchId: `m${i}`, matchDate: PAST, opponent: 'Opp',
    }));
    const profile = assembleLeagueTeamProfile(alpha, [], row('A'), manyMatches, true);

    assert.equal(profile.privateIntel!.recentMatchReports.length, 5);
  });

  it('privateIntel from one team must not appear in another team\'s profile', () => {
    // Demonstrates the gate prevents cross-team data leakage.
    // Alpha has permission; Beta does not (simulated by canViewPrivateIntel=false for beta's call).
    const alphaProfile = assembleLeagueTeamProfile(alpha, [], row('A'), ownMatchRefs, true);
    const betaProfile  = assembleLeagueTeamProfile(beta,  [], row('B'), [], false);

    assert.ok('privateIntel' in alphaProfile, 'Alpha (with permission) should have privateIntel');
    assert.ok(!('privateIntel' in betaProfile), 'Beta (without permission) must not have privateIntel');
    // Double-check Beta cannot reach Alpha's heatmap URL via the profile response
    assert.equal(JSON.stringify(betaProfile).includes('heatmap'), false,
      'No heatmap reference must leak into a profile returned to someone without MANAGE_TEAM');
  });
});

// ─── Profile assembly — public sections ───────────────────────────────────────

describe('assembleLeagueTeamProfile — public sections', () => {
  const alpha = team('A', 'Alpha');
  const beta  = team('B', 'Beta');
  const gamma = team('G', 'Gamma');

  it('basic fields are present', () => {
    const profile = assembleLeagueTeamProfile(alpha, [], null, [], false);
    assert.equal(profile.leagueTeamId, 'A');
    assert.equal(profile.teamId, alpha.teamId);
    assert.equal(profile.teamName, 'Alpha');
    assert.equal(profile.division, null);
    assert.equal(profile.standing, null);
    assert.deepEqual(profile.winLossTrend, []);
    assert.deepEqual(profile.recentResults, []);
    assert.deepEqual(profile.upcomingFixtures, []);
  });

  it('standing row is passed through correctly', () => {
    const standRow = row('A', 3, 1);
    const profile = assembleLeagueTeamProfile(alpha, [], standRow, [], false);
    assert.equal(profile.standing?.wins, 3);
    assert.equal(profile.standing?.losses, 1);
  });

  it('win/loss trend is oldest → newest', () => {
    // Alpha wins vs Beta on Jan 1, loses vs Gamma on Feb 1
    const fixtures = [
      fixture('f2', alpha, gamma, '2026-02-01T12:00:00Z', match(1, 3)), // Alpha loses 1-3
      fixture('f1', alpha, beta,  '2026-01-01T12:00:00Z', match(3, 0)), // Alpha wins 3-0
    ];
    const profile = assembleLeagueTeamProfile(alpha, fixtures, null, [], false);
    // Oldest first: Jan 1 (W), Feb 1 (L)
    assert.deepEqual(profile.winLossTrend, ['W', 'L']);
  });

  it('recent results are newest first, capped at 5', () => {
    // 6 completed fixtures, newest last in scheduled date order → we want last 5 newest first
    const fixtures = Array.from({ length: 6 }, (_, i) =>
      fixture(`f${i}`, alpha, beta, `2026-0${i + 1}-01T12:00:00Z`, match(3, 0)),
    );
    const profile = assembleLeagueTeamProfile(alpha, fixtures, null, [], false);
    assert.equal(profile.recentResults.length, 5);
    // Newest first: f5 (June) should be first
    assert.equal(profile.recentResults[0].fixtureId, 'f5');
    assert.equal(profile.recentResults[4].fixtureId, 'f1');
  });

  it('result from away-team perspective is correctly W when away team wins', () => {
    // Alpha is AWAY; homeMatch says Beta (home) won 1, Alpha (away) won 3
    // awayMatch.homeSetsWon=3 (Alpha), awayMatch.awaySetsWon=1 (Beta) — from Alpha's own Match
    const fixtures = [
      fixture('f1', beta, alpha, PAST, null, match(3, 1)), // Alpha's awayMatch: they won 3-1
    ];
    const profile = assembleLeagueTeamProfile(alpha, fixtures, null, [], false);
    assert.equal(profile.recentResults[0].result, 'W');
    assert.equal(profile.recentResults[0].isHome, false);
  });

  it('upcoming fixtures list only future unresolved fixtures', () => {
    const fixtures = [
      fixture('past-complete', alpha, beta, PAST, match(3, 1)), // completed
      fixture('past-pending',  alpha, beta, PAST),               // past but unresolved → pending (not shown here)
      fixture('future',        alpha, beta, FUTURE),             // upcoming ✓
    ];
    const profile = assembleLeagueTeamProfile(alpha, fixtures, null, [], false);
    assert.equal(profile.upcomingFixtures.length, 1);
    assert.equal(profile.upcomingFixtures[0].fixtureId, 'future');
  });

  it('fixtures for other teams do not appear in this team\'s profile', () => {
    // A fixture between beta and gamma should not appear in alpha's profile
    const fixtures = [
      fixture('f-other', beta, gamma, FUTURE),
      fixture('f-mine',  alpha, beta, FUTURE),
    ];
    const profile = assembleLeagueTeamProfile(alpha, fixtures, null, [], false);
    assert.equal(profile.upcomingFixtures.length, 1);
    assert.equal(profile.upcomingFixtures[0].fixtureId, 'f-mine');
  });
});
