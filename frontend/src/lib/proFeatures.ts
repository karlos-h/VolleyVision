/* eslint-disable @typescript-eslint/no-unused-vars -- the underscore parameters are the future paywall check's inputs */
// The single Pro switch. Free app now, a Pro team season pass after beta
// (players never pay); every Pro panel asks here, so the paywall is one change.

// 'aiSummary' is reserved: nothing uses it yet (the AI summary was removed in
// Sept 2026).
export const PRO_FEATURES = ['advancedAnalytics', 'rotations', 'momentum', 'heatmapsFull', 'multiSeasonFilters', 'printPdf', 'aiSummary'] as const;

export type ProFeature = typeof PRO_FEATURES[number];

// Always true until the paywall ships. The team (id or object) is a parameter
// so call sites already pass what a real per-team check will need.
export function teamHasPro(_team?: { id: string } | string | null): boolean {
  return true;
}

export const hasProFeature = (team: Parameters<typeof teamHasPro>[0], _feature: ProFeature) => teamHasPro(team);
