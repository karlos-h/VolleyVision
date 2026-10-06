// Feature flags — refocus VolleyVision on its core (coaches and players seeing
// team and personal stats). Leagues, video, the assistant, scouting and
// recommendations were removed entirely (not just hidden) — see CHANGELOG.
// Heat maps, rotation analytics and momentum were removed too, then restored
// in v9.8.0 and v9.12.0. Flip teamChat off only if the polled channel needs to
// be pulled temporarily. The Pro switch lives in lib/proFeatures.ts.

export const features = {
  // Team chat — one shared channel per team (polled).
  teamChat: true,
} as const;

export type FeatureFlag = keyof typeof features;

export function isEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
