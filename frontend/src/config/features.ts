// Feature flags — refocus VolleyVision on its core (coaches and players seeing
// team and personal stats). Advanced modules remain in the codebase but are
// hidden from the UI until re-enabled here. Flip a flag to bring one back.

export const features = {
  // League Intelligence: leagues, seasons, fixtures, standings, rankings, match centre.
  leagues: false,

  // Match video upload + timestamp tagging.
  video: false,

  // Natural-language analytics assistant.
  assistant: false,

  // Opponent scouting reports.
  opponentScouting: false,

  // Court heat maps / zone breakdowns.
  heatMaps: false,

  // Coaching + training recommendation engines.
  recommendations: false,

  // Rotation analytics panels.
  rotationAnalytics: false,

  // Match momentum timeline charts.
  momentum: false,
} as const;

export type FeatureFlag = keyof typeof features;

export function isEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
