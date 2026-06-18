export interface MatchIntegrityInput {
  homeScore: number;
  awayScore: number;
  homeSetsWon: number;
  awaySetsWon: number;
  status: string;
  setScores?: { set: number; home: number; away: number }[];
}

export interface IntegrityResult {
  ok: boolean;
  violations: string[];
}

/**
 * Checks a match record for logical consistency.
 * Returns all detected violations so callers can log, alert, or repair.
 */
export function checkMatchIntegrity(match: MatchIntegrityInput): IntegrityResult {
  const violations: string[] = [];

  // Scores must be non-negative
  if (match.homeScore < 0) violations.push('homeScore is negative.');
  if (match.awayScore < 0) violations.push('awayScore is negative.');
  if (match.homeSetsWon < 0) violations.push('homeSetsWon is negative.');
  if (match.awaySetsWon < 0) violations.push('awaySetsWon is negative.');

  // Sets won must be within volleyball limits
  if (match.homeSetsWon > 3) violations.push('homeSetsWon exceeds 3.');
  if (match.awaySetsWon > 3) violations.push('awaySetsWon exceeds 3.');
  if (match.homeSetsWon + match.awaySetsWon > 5) violations.push('Total sets won exceeds 5.');
  if (match.homeSetsWon === 3 && match.awaySetsWon === 3) {
    violations.push('Both teams show 3 sets won simultaneously.');
  }

  // Completed match must have a winner
  if (match.status === 'COMPLETED') {
    if (match.homeSetsWon < 3 && match.awaySetsWon < 3) {
      violations.push('Match is COMPLETED but neither team has won 3 sets.');
    }
  }

  // In-progress match must not already have a winner
  if (match.status === 'IN_PROGRESS') {
    if (match.homeSetsWon >= 3 || match.awaySetsWon >= 3) {
      violations.push('Match is IN_PROGRESS but a team has already won 3 sets — should be COMPLETED.');
    }
  }

  // Set score history consistency
  if (match.setScores && match.setScores.length > 0) {
    const recordedSets = match.setScores.length;
    const totalSetsWon = match.homeSetsWon + match.awaySetsWon;
    if (recordedSets !== totalSetsWon) {
      violations.push(
        `setScores has ${recordedSets} entries but homeSetsWon + awaySetsWon = ${totalSetsWon}.`,
      );
    }
    for (const s of match.setScores) {
      if (s.home < 0 || s.away < 0) violations.push(`Set ${s.set} has a negative score in history.`);
    }
  }

  return { ok: violations.length === 0, violations };
}
