import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeStandings, resolveLiveFixtureState, resolveFixtureResult } from '../services/leagueStandings.service';
import type { LeagueTeamSnapshot, FixtureSnapshot } from '../services/leagueStandings.service';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function team(id: string, name: string): LeagueTeamSnapshot {
  return { id, teamId: `t${id}`, team: { name } };
}

function match(homeSetsWon: number, awaySetsWon: number, status = 'COMPLETED') {
  return { id: `m-${Math.random()}`, homeSetsWon, awaySetsWon, status };
}

function liveMatch(homeSetsWon: number, awaySetsWon: number, homeScore: number, awayScore: number) {
  return { id: `m-live-${Math.random()}`, homeSetsWon, awaySetsWon, homeScore, awayScore, status: 'IN_PROGRESS' };
}

function fixture(
  id: string,
  homeLeagueTeamId: string,
  awayLeagueTeamId: string,
  homeLeagueTeam: LeagueTeamSnapshot,
  awayLeagueTeam: LeagueTeamSnapshot,
  homeMatch: ReturnType<typeof match> | null = null,
  awayMatch: ReturnType<typeof match> | null = null,
): FixtureSnapshot {
  return { id, homeLeagueTeamId, awayLeagueTeamId, homeLeagueTeam, awayLeagueTeam, homeMatch, awayMatch };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeStandings', () => {
  it('empty season — no fixtures — all teams appear with zero stats', () => {
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const { standings, fixtureResults } = computeStandings([alpha, beta], []);

    assert.equal(standings.length, 2);
    assert.equal(fixtureResults.length, 0);
    for (const row of standings) {
      assert.equal(row.matchesPlayed, 0);
      assert.equal(row.wins, 0);
      assert.equal(row.points, 0);
      assert.equal(row.setDifferential, 0);
    }
  });

  it('unplayed fixture contributes zero to both teams', () => {
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    // No match linked on either side.
    const f = fixture('f1', 'A', 'B', alpha, beta, null, null);
    const { standings, fixtureResults } = computeStandings([alpha, beta], [f]);

    assert.equal(fixtureResults[0].played, false);
    for (const row of standings) {
      assert.equal(row.matchesPlayed, 0);
      assert.equal(row.points, 0);
    }
  });

  it('fixture with status !== COMPLETED is treated as unplayed', () => {
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const f = fixture('f1', 'A', 'B', alpha, beta, match(3, 1, 'IN_PROGRESS'), null);
    const { fixtureResults } = computeStandings([alpha, beta], [f]);

    assert.equal(fixtureResults[0].played, false);
  });

  it('one-side-linked — home match only — resolves correctly', () => {
    // Fixture: Alpha (home) vs Beta (away)
    // Alpha linked their Match: they won 3-1 (from their own perspective, homeSetsWon=3, awaySetsWon=1)
    // Translation to fixture framing: Alpha (fixture home) sets = 3, Beta (fixture away) sets = 1
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const f = fixture('f1', 'A', 'B', alpha, beta, match(3, 1), null);
    const { standings, fixtureResults } = computeStandings([alpha, beta], [f]);

    assert.equal(fixtureResults[0].played, true);
    assert.equal(fixtureResults[0].homeSetsWon, 3);
    assert.equal(fixtureResults[0].awaySetsWon, 1);
    assert.equal(fixtureResults[0].hasDiscrepancy, false);

    const alphaRow = standings.find((r) => r.leagueTeamId === 'A')!;
    const betaRow = standings.find((r) => r.leagueTeamId === 'B')!;
    assert.equal(alphaRow.wins, 1);
    assert.equal(alphaRow.points, 2);
    assert.equal(alphaRow.setsWon, 3);
    assert.equal(alphaRow.setsLost, 1);
    assert.equal(betaRow.wins, 0);
    assert.equal(betaRow.points, 1);
    assert.equal(betaRow.setsWon, 1);
    assert.equal(betaRow.setsLost, 3);
  });

  it('one-side-linked — away match only — translates "away team perspective" correctly', () => {
    // Fixture: Alpha (home) vs Beta (away)
    // Only Beta linked their Match.  In Beta's own Match record they are the "home" owner:
    //   awayMatch.homeSetsWon = 2  → Beta's own sets (fixture away sets)
    //   awayMatch.awaySetsWon = 3  → Alpha's sets   (fixture home sets) — Beta's opponent
    // Translation: fixture homeSetsWon=3 (Alpha), fixture awaySetsWon=2 (Beta) → Alpha wins
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const f = fixture('f1', 'A', 'B', alpha, beta, null, match(2, 3)); // Beta's Match: they won 2, opponent won 3
    const { standings, fixtureResults } = computeStandings([alpha, beta], [f]);

    assert.equal(fixtureResults[0].played, true);
    assert.equal(fixtureResults[0].homeSetsWon, 3);  // Alpha (fixture home)
    assert.equal(fixtureResults[0].awaySetsWon, 2);  // Beta  (fixture away)
    assert.equal(fixtureResults[0].hasDiscrepancy, false);

    const alphaRow = standings.find((r) => r.leagueTeamId === 'A')!;
    const betaRow = standings.find((r) => r.leagueTeamId === 'B')!;
    assert.equal(alphaRow.wins, 1);
    assert.equal(betaRow.wins, 0);
  });

  it('both sides linked and agreeing — no discrepancy, correct stats', () => {
    // Alpha (home): homeMatch.homeSetsWon=3, homeMatch.awaySetsWon=0 → Alpha 3, Beta 0
    // Beta  (away): awayMatch.homeSetsWon=0, awayMatch.awaySetsWon=3 → fixture home=3, away=0 → same
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const f = fixture('f1', 'A', 'B', alpha, beta, match(3, 0), match(0, 3));
    const { fixtureResults } = computeStandings([alpha, beta], [f]);

    assert.equal(fixtureResults[0].hasDiscrepancy, false);
    assert.equal(fixtureResults[0].homeSetsWon, 3);
    assert.equal(fixtureResults[0].awaySetsWon, 0);
  });

  it('both sides disagree — home side authoritative, hasDiscrepancy true', () => {
    // Alpha (home) linked their Match: they won 3 sets, opponent won 2.
    //   → fixtureHomeSetsWon=3, fixtureAwaySetsWon=2 (Alpha wins)
    // Beta  (away) linked their Match: they say they won 3, opponent won 1.
    //   awayMatch.homeSetsWon=3, awayMatch.awaySetsWon=1
    //   → fixtureHomeSetsWon=1, fixtureAwaySetsWon=3 (would mean Beta wins — contradicts home)
    // Resolution: home side (Alpha 3-2) is used; hasDiscrepancy=true
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const f = fixture('f1', 'A', 'B', alpha, beta, match(3, 2), match(3, 1));
    const { standings, fixtureResults } = computeStandings([alpha, beta], [f]);

    assert.equal(fixtureResults[0].hasDiscrepancy, true);
    assert.equal(fixtureResults[0].homeSetsWon, 3); // home (Alpha) wins per home data
    assert.equal(fixtureResults[0].awaySetsWon, 2);

    const alphaRow = standings.find((r) => r.leagueTeamId === 'A')!;
    assert.equal(alphaRow.wins, 1);
    assert.equal(alphaRow.setsWon, 3);
    assert.equal(alphaRow.setsLost, 2);
  });

  it('fully-played round-robin — clear ranking, correct points order', () => {
    // Three teams: Alpha, Beta, Gamma
    // Fixtures (home then away):
    //   Alpha vs Beta:  Alpha wins 3-1
    //   Alpha vs Gamma: Alpha wins 3-0
    //   Beta  vs Gamma: Beta  wins 3-2
    // Expected standings: Alpha 4pts, Beta 3pts, Gamma 2pts
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const gamma = team('G', 'Gamma');

    const fixtures = [
      fixture('f1', 'A', 'B', alpha, beta, match(3, 1)),
      fixture('f2', 'A', 'G', alpha, gamma, match(3, 0)),
      fixture('f3', 'B', 'G', beta, gamma, match(3, 2)),
    ];

    const { standings } = computeStandings([alpha, beta, gamma], fixtures);

    assert.equal(standings[0].leagueTeamId, 'A');
    assert.equal(standings[0].points, 4);
    assert.equal(standings[0].wins, 2);
    assert.equal(standings[0].setsWon, 6);

    assert.equal(standings[1].leagueTeamId, 'B');
    assert.equal(standings[1].points, 3); // won vs Gamma (+2), lost to Alpha (+1)
    assert.equal(standings[1].wins, 1);
    assert.equal(standings[1].losses, 1);

    assert.equal(standings[2].leagueTeamId, 'G');
    assert.equal(standings[2].points, 2); // lost both, 1pt each
    assert.equal(standings[2].wins, 0);
    assert.equal(standings[2].losses, 2);
  });

  it('tiebreaker — equal points, decided by set differential', () => {
    // Alpha: 1 win 3-0  → points=2, setsWon=3, setsLost=0, diff=+3
    // Beta:  1 win 3-2  → points=2, setsWon=3, setsLost=2, diff=+1
    // Alpha ranks above Beta despite equal points.
    const alpha = team('A', 'Alpha');
    const beta = team('B', 'Beta');
    const gamma = team('G', 'Gamma');
    const delta = team('D', 'Delta');

    const fixtures = [
      fixture('f1', 'A', 'G', alpha, gamma, match(3, 0)), // Alpha wins 3-0
      fixture('f2', 'B', 'D', beta, delta, match(3, 2)),  // Beta  wins 3-2
    ];

    const { standings } = computeStandings([alpha, beta, gamma, delta], fixtures);
    const alphaRow = standings.find((r) => r.leagueTeamId === 'A')!;
    const betaRow = standings.find((r) => r.leagueTeamId === 'B')!;

    assert.ok(standings.indexOf(alphaRow) < standings.indexOf(betaRow),
      'Alpha should rank above Beta due to better set differential');
  });

  it('full tie — equal points and differential — decided alphabetically by team name', () => {
    // Zeta and Alpha both win 3-1 in their respective matches: same points, same diff.
    // Alpha comes first alphabetically.
    const alpha = team('A', 'Alpha');
    const zeta = team('Z', 'Zeta');
    const gamma = team('G', 'Gamma');
    const delta = team('D', 'Delta');

    const fixtures = [
      fixture('f1', 'A', 'G', alpha, gamma, match(3, 1)), // Alpha wins 3-1, diff=+2
      fixture('f2', 'Z', 'D', zeta, delta, match(3, 1)),  // Zeta  wins 3-1, diff=+2
    ];

    const { standings } = computeStandings([alpha, zeta, gamma, delta], fixtures);
    const alphaRow = standings.find((r) => r.leagueTeamId === 'A')!;
    const zetaRow = standings.find((r) => r.leagueTeamId === 'Z')!;

    assert.ok(standings.indexOf(alphaRow) < standings.indexOf(zetaRow),
      'Alpha should rank above Zeta alphabetically when all other factors tie');
  });
});

// ─── resolveLiveFixtureState ──────────────────────────────────────────────────

describe('resolveLiveFixtureState', () => {
  const alpha = team('A', 'Alpha');
  const beta  = team('B', 'Beta');

  it('returns isLive=false when no linked match is IN_PROGRESS', () => {
    const f = fixture('f1', 'A', 'B', alpha, beta, null, null);
    const state = resolveLiveFixtureState(f);
    assert.equal(state.isLive, false);
    assert.equal(state.currentSet, 0);
    assert.equal(state.homeSetScore, 0);
    assert.equal(state.awaySetScore, 0);
    assert.equal(state.sourceMatchId, null);
  });

  it('returns isLive=false when linked match is COMPLETED (not IN_PROGRESS)', () => {
    const f = fixture('f1', 'A', 'B', alpha, beta, match(3, 1), null);
    const state = resolveLiveFixtureState(f);
    assert.equal(state.isLive, false);
  });

  it('translates home-linked IN_PROGRESS match correctly — fixture framing', () => {
    // Alpha (home in fixture) owns the homeMatch.
    // homeMatch.homeSetsWon=1, homeMatch.awaySetsWon=0 → fixture: Alpha leads sets 1-0
    // homeMatch.homeScore=18, homeMatch.awayScore=14 → fixture: Alpha leads set 2 by 18-14
    const live = liveMatch(1, 0, 18, 14);
    const f = fixture('f1', 'A', 'B', alpha, beta, live as any, null);
    const state = resolveLiveFixtureState(f);

    assert.equal(state.isLive, true);
    assert.equal(state.homeSetsWon, 1);   // Alpha (fixture home) sets won
    assert.equal(state.awaySetsWon, 0);   // Beta (fixture away) sets won
    assert.equal(state.currentSet, 2);    // 1+0+1
    assert.equal(state.homeSetScore, 18); // Alpha's current set score
    assert.equal(state.awaySetScore, 14); // Beta's current set score
    assert.equal(state.sourceMatchId, live.id);
  });

  it('translates away-linked IN_PROGRESS match — inverts perspective correctly', () => {
    // Beta (away in fixture) owns the awayMatch.
    // awayMatch perspective: "home" = Beta (fixture away), "away" = Alpha (fixture home)
    // awayMatch.homeSetsWon=2 → Beta (fixture away) has 2 sets
    // awayMatch.awaySetsWon=1 → Alpha (fixture home) has 1 set
    // awayMatch.homeScore=22  → Beta's current set score
    // awayMatch.awayScore=20  → Alpha's current set score
    //
    // After translation to fixture framing:
    //   fixture homeSetScore = awayMatch.awayScore = 20 (Alpha)
    //   fixture awaySetScore = awayMatch.homeScore = 22 (Beta)
    //   fixture homeSetsWon  = awayMatch.awaySetsWon = 1
    //   fixture awaySetsWon  = awayMatch.homeSetsWon = 2
    const live = liveMatch(2, 1, 22, 20); // Beta's Match: Beta home, Alpha away
    const f = fixture('f1', 'A', 'B', alpha, beta, null, live as any);
    const state = resolveLiveFixtureState(f);

    assert.equal(state.isLive, true);
    assert.equal(state.homeSetsWon, 1,   'fixture home (Alpha) should have 1 set won');
    assert.equal(state.awaySetsWon, 2,   'fixture away (Beta) should have 2 sets won');
    assert.equal(state.homeSetScore, 20, 'fixture home (Alpha) should have 20 in current set');
    assert.equal(state.awaySetScore, 22, 'fixture away (Beta) should have 22 in current set');
    assert.equal(state.currentSet, 4);   // 1+2+1
  });

  it('when home match is IN_PROGRESS, home match is authoritative (over away match also IN_PROGRESS)', () => {
    const homeLive = liveMatch(0, 0, 10, 8);
    const awayLive = liveMatch(0, 0, 99, 99); // should be ignored
    const f = fixture('f1', 'A', 'B', alpha, beta, homeLive as any, awayLive as any);
    const state = resolveLiveFixtureState(f);
    assert.equal(state.homeSetScore, 10);
    assert.equal(state.awaySetScore, 8);
    assert.equal(state.sourceMatchId, homeLive.id);
  });

  it('a live fixture does NOT resolve as played in resolveFixtureResult', () => {
    // An IN_PROGRESS match is not COMPLETED, so resolveFixtureResult should treat it as unplayed.
    const live = liveMatch(1, 0, 18, 14);
    const f = fixture('f1', 'A', 'B', alpha, beta, live as any, null);
    const result = resolveFixtureResult(f);
    assert.equal(result.played, false, 'IN_PROGRESS match must not appear as played in standings/results');
  });

  it('a fixture with no linked match at all returns isLive=false and resolves as unplayed', () => {
    const f = fixture('f1', 'A', 'B', alpha, beta, null, null);
    assert.equal(resolveLiveFixtureState(f).isLive, false);
    assert.equal(resolveFixtureResult(f).played, false);
  });
});
