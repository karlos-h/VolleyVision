/**
 * Client-side mirror of the backend `resolveFixtureResult` function.
 *
 * Encapsulates the home/away-naming nuance: in a team's own Match record,
 * "home" always means *that team* and "away" always means *their opponent*,
 * completely independent of the fixture-level home/away label.
 *
 * Do NOT inline this logic in pages — import from here so the nuance lives
 * in exactly one place on the frontend.
 */

import type { LeagueMatch, ResolvedFixtureResult } from '../types';

export function resolveFixture(fixture: LeagueMatch): ResolvedFixtureResult {
  const { homeMatch, awayMatch } = fixture;

  const homeCompleted = homeMatch?.status === 'COMPLETED';
  const awayCompleted = awayMatch?.status === 'COMPLETED';

  if (!homeCompleted && !awayCompleted) {
    return { fixtureId: fixture.id, played: false, homeSetsWon: 0, awaySetsWon: 0, hasDiscrepancy: false };
  }

  const fromHome = homeCompleted
    ? { home: homeMatch!.homeSetsWon, away: homeMatch!.awaySetsWon }
    : null;

  // Away team's Match: their "home" = fixture's away team; their "away" = fixture's home team.
  const fromAway = awayCompleted
    ? { home: awayMatch!.awaySetsWon, away: awayMatch!.homeSetsWon }
    : null;

  if (fromHome && fromAway) {
    const disagree = fromHome.home !== fromAway.home || fromHome.away !== fromAway.away;
    return {
      fixtureId: fixture.id,
      played: true,
      homeSetsWon: fromHome.home,
      awaySetsWon: fromHome.away,
      hasDiscrepancy: disagree,
    };
  }

  const source = fromHome ?? fromAway!;
  return { fixtureId: fixture.id, played: true, homeSetsWon: source.home, awaySetsWon: source.away, hasDiscrepancy: false };
}
