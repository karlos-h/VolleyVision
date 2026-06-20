import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeLeagueRankings } from '../services/leagueRankings.service';
import type { SeasonMatchData, LeagueMatchEventSet } from '../services/leagueRankings.service';
import { EventType, Position } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function player(id: string, first: string, last: string) {
  return { id, firstName: first, lastName: last, jerseyNumber: 1, position: Position.OUTSIDE_HITTER };
}

function evt(playerId: string | null, eventType: EventType, isOpponentEvent = false) {
  return { playerId, eventType, setNumber: 1, isOpponentEvent } as any;
}

function matchSet(leagueTeamId: string, teamId: string, events: any[], players: any[] = []): LeagueMatchEventSet {
  return { leagueTeamId, teamId, events, players };
}

function league(teams: Array<{ id: string; name: string }>): SeasonMatchData['leagueTeams'] {
  return teams.map((t) => ({ id: t.id, teamId: `team-${t.id}`, team: { name: t.name } }));
}

const KILL       = EventType.KILL;
const ATT        = EventType.ATTACK_ATTEMPT;
const ATK_ERR    = EventType.ATTACK_ERROR;
const ACE        = EventType.ACE;
const SERVE_IN   = EventType.SERVE_IN;
const SRV_ERR    = EventType.SERVICE_ERROR;
const SOLO_BLOCK = EventType.SOLO_BLOCK;
const DIG        = EventType.DIG;
const ASSIST     = EventType.ASSIST;

// ─── Empty season ─────────────────────────────────────────────────────────────

describe('computeLeagueRankings — empty season', () => {
  it('returns empty lists when there are no match sets', () => {
    const result = computeLeagueRankings({ matchSets: [], leagueTeams: [] });
    assert.deepEqual(result.teamRankings.attackEfficiency, []);
    assert.deepEqual(result.teamRankings.blocking, []);
    assert.deepEqual(result.playerLeaderboards.kills, []);
    assert.deepEqual(result.playerLeaderboards.aces, []);
  });
});

// ─── Minimum sample guard — teams ────────────────────────────────────────────

describe('computeLeagueRankings — minimum match threshold for team rankings', () => {
  it('excludes a team with only 1 completed league match from ALL team rankings', () => {
    // Team A: 1 match (insufficient); Team B: 2 matches (sufficient).
    const p1 = player('p1', 'Alice', 'Smith');
    const p2 = player('p2', 'Bob', 'Jones');

    // 12 kills and 12 attack attempts → good attack; but only 1 match
    const teamAEvents = Array.from({ length: 12 }, () => evt('p1', KILL));
    // Team B has 2 matches with moderate attack
    const teamBEvents1 = [evt('p2', KILL), evt('p2', ATT), ...Array.from({ length: 8 }, () => evt('p2', ATT))];
    const teamBEvents2 = [evt('p2', KILL), ...Array.from({ length: 9 }, () => evt('p2', ATT))];

    const data: SeasonMatchData = {
      matchSets: [
        matchSet('lt-A', 'team-A', teamAEvents, [p1]),
        matchSet('lt-B', 'team-B', teamBEvents1, [p2]),
        matchSet('lt-B', 'team-B', teamBEvents2, [p2]),
      ],
      leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }, { id: 'lt-B', name: 'Beta' }]),
    };

    const result = computeLeagueRankings(data);

    const teamIds = result.teamRankings.attackEfficiency.map((e) => e.leagueTeamId);
    assert.ok(!teamIds.includes('lt-A'), 'Alpha (1 match) must be excluded from attackEfficiency');
    assert.ok(teamIds.includes('lt-B'), 'Beta (2 matches) must be included in attackEfficiency');

    // Same for blocking and defense
    assert.ok(!result.teamRankings.blocking.map((e) => e.leagueTeamId).includes('lt-A'));
    assert.ok(!result.teamRankings.defense.map((e) => e.leagueTeamId).includes('lt-A'));
  });
});

// ─── Team attack efficiency ranking ──────────────────────────────────────────

describe('computeLeagueRankings — team attack efficiency', () => {
  it('ranks teams by hitting percentage, best first', () => {
    // Alpha: 8 kills, 2 errors, 10 atts → hitting % = (8-2)/10 = 0.600
    // Beta:  4 kills, 4 errors, 10 atts → hitting % = (4-4)/10 = 0.000
    // Both need ≥2 matches — supply 2 identical sets each.
    const pA = player('pA', 'A', 'Player');
    const pB = player('pB', 'B', 'Player');

    const alphaEvts = [
      ...Array.from({ length: 8 }, () => evt('pA', KILL)),
      ...Array.from({ length: 2 }, () => evt('pA', ATK_ERR)),
    ];
    const betaEvts = [
      ...Array.from({ length: 4 }, () => evt('pB', KILL)),
      ...Array.from({ length: 4 }, () => evt('pB', ATK_ERR)),
      ...Array.from({ length: 2 }, () => evt('pB', ATT)),
    ];

    const data: SeasonMatchData = {
      matchSets: [
        matchSet('lt-A', 'team-A', alphaEvts, [pA]),
        matchSet('lt-A', 'team-A', alphaEvts, [pA]),
        matchSet('lt-B', 'team-B', betaEvts, [pB]),
        matchSet('lt-B', 'team-B', betaEvts, [pB]),
      ],
      leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }, { id: 'lt-B', name: 'Beta' }]),
    };

    const { attackEfficiency } = computeLeagueRankings(data).teamRankings;
    assert.equal(attackEfficiency.length, 2);
    assert.equal(attackEfficiency[0].leagueTeamId, 'lt-A');
    assert.equal(attackEfficiency[1].leagueTeamId, 'lt-B');
    assert.ok(attackEfficiency[0].value > attackEfficiency[1].value, 'Alpha must have higher hitting %');
  });
});

// ─── Player leaderboard — kills ──────────────────────────────────────────────

describe('computeLeagueRankings — player kill leaderboard', () => {
  it('ranks players by kills and excludes players below 10 attack attempts', () => {
    const p1 = player('p1', 'Alice', 'Smith');
    const p2 = player('p2', 'Bob', 'Jones');
    const p3 = player('p3', 'Cara', 'Lee'); // will have <10 attack attempts

    // p1: 8 kills, 3 atts per match → 2 matches → 22 total atts (qualifies)
    // p2: 5 kills, 6 atts per match → 2 matches → 22 total atts (qualifies, fewer kills)
    // p3: 1 kill, 3 atts per match  → 2 matches → 8 total atts (<10, does NOT qualify)
    const events = [
      ...Array.from({ length: 8 }, () => evt('p1', KILL)),
      ...Array.from({ length: 3 }, () => evt('p1', ATT)),
      ...Array.from({ length: 5 }, () => evt('p2', KILL)),
      ...Array.from({ length: 6 }, () => evt('p2', ATT)),
      ...Array.from({ length: 1 }, () => evt('p3', KILL)),
      ...Array.from({ length: 3 }, () => evt('p3', ATT)),
    ];

    const data: SeasonMatchData = {
      matchSets: [
        matchSet('lt-A', 'team-A', events, [p1, p2, p3]),
        matchSet('lt-A', 'team-A', events, [p1, p2, p3]), // 2nd match so team qualifies
      ],
      leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }]),
    };

    const { kills } = computeLeagueRankings(data).playerLeaderboards;
    const playerIds = kills.map((e) => e.playerId);
    assert.ok(playerIds.includes('p1'), 'p1 should qualify and appear');
    assert.ok(playerIds.includes('p2'), 'p2 should qualify and appear');
    assert.ok(!playerIds.includes('p3'), 'p3 (< 10 attack attempts) must be excluded');
    assert.equal(kills[0].playerId, 'p1', 'p1 (8+8=16 kills) must rank above p2 (5+5=10 kills)');
  });
});

// ─── Opponent events excluded ─────────────────────────────────────────────────

describe('computeLeagueRankings — opponent event exclusion', () => {
  it('opponent-tagged events do not contribute to any ranking', () => {
    const p1 = player('p1', 'Alice', 'Smith');

    // 8 kills from Alice (own events) + 100 kills tagged as opponent events (should not count)
    const events = [
      ...Array.from({ length: 8 }, () => evt('p1', KILL, false)), // own
      ...Array.from({ length: 2 }, () => evt('p1', ATK_ERR, false)),
      ...Array.from({ length: 100 }, () => evt(null, KILL, true)), // opponent — must be ignored
      ...Array.from({ length: 100 }, () => evt(null, ACE, true)),  // opponent — must be ignored
    ];

    const data: SeasonMatchData = {
      matchSets: [
        matchSet('lt-A', 'team-A', events, [p1]),
        matchSet('lt-A', 'team-A', events, [p1]),
      ],
      leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }]),
    };

    const result = computeLeagueRankings(data);

    // Attack efficiency must be computed only from own events: (8*2 - 2*2) / (10*2) = 0.600
    const ae = result.teamRankings.attackEfficiency[0];
    assert.ok(ae, 'attack efficiency entry must exist');
    assert.ok(Math.abs(ae.value - 0.6) < 0.01, `Expected ~0.600 hitting %, got ${ae.value}`);

    // Player kills must not include opponent events
    const topKiller = result.playerLeaderboards.kills[0];
    if (topKiller) {
      assert.equal(topKiller.playerId, 'p1');
      assert.equal(topKiller.value, 16, 'kills must be 8 per match × 2 matches = 16, not inflated by opponent events');
    }
  });
});

// ─── Unlinked or non-completed LeagueMatch contributes nothing ────────────────

describe('computeLeagueRankings — unlinked/non-completed fixtures excluded', () => {
  it('a fixture with no linked match sets contributes zero to rankings', () => {
    // If a fixture has no homeMatch/awayMatch linked, the controller will not
    // produce any LeagueMatchEventSet for it, so the match sets array will be empty.
    // This test confirms empty match sets → empty results (not an error).
    const result = computeLeagueRankings({ matchSets: [], leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }]) });
    assert.deepEqual(result.teamRankings.attackEfficiency, []);
    assert.deepEqual(result.playerLeaderboards.kills, []);
  });

  it('a team with all events from a single linked match is excluded from team rankings', () => {
    const p = player('p1', 'A', 'B');
    const evts = Array.from({ length: 20 }, () => evt('p1', KILL));
    const data: SeasonMatchData = {
      matchSets: [matchSet('lt-A', 'team-A', evts, [p])], // only 1 match
      leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }]),
    };
    const result = computeLeagueRankings(data);
    // Should not appear in blocking or defense (those don't require attack attempts)
    assert.deepEqual(result.teamRankings.blocking, []);
    assert.deepEqual(result.teamRankings.defense, []);
  });
});

// ─── Serve minimum attempt guard ──────────────────────────────────────────────

describe('computeLeagueRankings — ace leaderboard minimum serve attempt guard', () => {
  it('a player with 1 ace from 1 serve attempt does not top the board', () => {
    const p1 = player('p1', 'Lucky', 'Server');
    const p2 = player('p2', 'Steady', 'Server');

    // p1: 1 ace from 1 serve attempt (9 < 10 minimum — excluded)
    // p2: 3 aces from 12 serve attempts (qualifies)
    const events = [
      evt('p1', ACE),
      ...Array.from({ length: 3 }, () => evt('p2', ACE)),
      ...Array.from({ length: 9 }, () => evt('p2', SERVE_IN)),
    ];

    const data: SeasonMatchData = {
      matchSets: [
        matchSet('lt-A', 'team-A', events, [p1, p2]),
        matchSet('lt-A', 'team-A', events, [p1, p2]),
      ],
      leagueTeams: league([{ id: 'lt-A', name: 'Alpha' }]),
    };

    const { aces } = computeLeagueRankings(data).playerLeaderboards;
    const playerIds = aces.map((e) => e.playerId);
    assert.ok(!playerIds.includes('p1'), 'p1 (< 10 serve attempts) must be excluded from ace leaderboard');
    assert.ok(playerIds.includes('p2'), 'p2 (≥ 10 serve attempts) must appear');
  });
});
