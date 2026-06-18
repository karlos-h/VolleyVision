export interface ScoreState {
  homeScore: number;
  awayScore: number;
  homeSetsWon: number;
  awaySetsWon: number;
  status?: string;
  setScores?: { set: number; home: number; away: number }[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Full validation of a match score state before it is written to the database. */
export function validateMatchScore(state: ScoreState): ValidationResult {
  const errors: string[] = [];

  // Basic non-negative checks
  if (state.homeScore < 0) errors.push('homeScore cannot be negative.');
  if (state.awayScore < 0) errors.push('awayScore cannot be negative.');
  if (state.homeSetsWon < 0) errors.push('homeSetsWon cannot be negative.');
  if (state.awaySetsWon < 0) errors.push('awaySetsWon cannot be negative.');

  // Sets won bounds
  if (state.homeSetsWon > 3) errors.push('homeSetsWon cannot exceed 3.');
  if (state.awaySetsWon > 3) errors.push('awaySetsWon cannot exceed 3.');

  const totalSets = state.homeSetsWon + state.awaySetsWon;
  if (totalSets > 5) errors.push('Total sets won cannot exceed 5.');
  if (state.homeSetsWon === 3 && state.awaySetsWon === 3) {
    errors.push('Both teams cannot have won 3 sets simultaneously.');
  }

  // Current set score sanity: max points within a set is bounded
  const currentSet = totalSets + 1;
  const maxInSet = currentSet >= 5 ? 17 : 30; // generous ceiling to catch runaway scores
  if (state.homeScore > maxInSet) errors.push(`homeScore exceeds reasonable maximum for set ${currentSet}.`);
  if (state.awayScore > maxInSet) errors.push(`awayScore exceeds reasonable maximum for set ${currentSet}.`);

  // Winner/completion consistency
  if (state.status === 'COMPLETED') {
    if (state.homeSetsWon < 3 && state.awaySetsWon < 3) {
      errors.push('Match is COMPLETED but no team has won 3 sets.');
    }
  }

  // Set history consistency
  if (state.setScores && state.setScores.length > 0) {
    if (state.setScores.length > 5) errors.push('setScores cannot have more than 5 entries.');
    for (const s of state.setScores) {
      if (s.home < 0 || s.away < 0) errors.push(`Set ${s.set} has a negative score.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Clamps a score to a valid non-negative value. */
export function clampScore(value: number): number {
  return Math.max(0, value);
}
