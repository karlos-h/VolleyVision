// Centralised scoring rules for VolleyVision.
// All event-to-score mappings live here so Phase 5 additions (challenge reviews,
// opponent tracking, rule customization) have a single place to change.

export const HOME_POINT_EVENTS: readonly string[] = [
  'KILL',
  'ACE',
  'SOLO_BLOCK',
  'BLOCK_ASSIST',
] as const;

export const AWAY_POINT_EVENTS: readonly string[] = [
  'ATTACK_ERROR',
  'SERVICE_ERROR',
  'DIG_ERROR',
  'SETTING_ERROR',
  'BLOCK_ERROR',
] as const;

export const HOME_POINT_SET = new Set(HOME_POINT_EVENTS);
export const AWAY_POINT_SET = new Set(AWAY_POINT_EVENTS);

/** Returns which team scores a point for this event type, or null if non-scoring. */
export function scoringTeam(eventType: string): 'home' | 'away' | null {
  if (HOME_POINT_SET.has(eventType)) return 'home';
  if (AWAY_POINT_SET.has(eventType)) return 'away';
  return null;
}
