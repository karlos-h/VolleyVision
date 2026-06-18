export interface ScoreState {
  homeScore: number;
  awayScore: number;
  homeSetsWon: number;
  awaySetsWon: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates a score state before it is written to the database. */
export function validateMatchScore(state: ScoreState): ValidationResult {
  const errors: string[] = [];

  if (state.homeScore < 0) errors.push('homeScore cannot be negative.');
  if (state.awayScore < 0) errors.push('awayScore cannot be negative.');
  if (state.homeSetsWon < 0) errors.push('homeSetsWon cannot be negative.');
  if (state.awaySetsWon < 0) errors.push('awaySetsWon cannot be negative.');
  if (state.homeSetsWon > 3) errors.push('homeSetsWon cannot exceed 3.');
  if (state.awaySetsWon > 3) errors.push('awaySetsWon cannot exceed 3.');

  const totalSets = state.homeSetsWon + state.awaySetsWon;
  if (totalSets > 5) errors.push('Total sets won cannot exceed 5.');

  // Both teams cannot have won 3 sets
  if (state.homeSetsWon === 3 && state.awaySetsWon === 3) {
    errors.push('Both teams cannot have won 3 sets simultaneously.');
  }

  return { valid: errors.length === 0, errors };
}

/** Clamps a score to a valid non-negative value. */
export function clampScore(value: number): number {
  return Math.max(0, value);
}
