// Tested copy of frontend/src/lib/proFeatures.ts (the frontend has no test runner);
// from PRO_FEATURES to the end it must stay identical, proFeatures.test.ts checks.

export const PRO_FEATURES = ['advancedAnalytics', 'rotations', 'momentum', 'heatmapsFull', 'multiSeasonFilters', 'printPdf', 'aiSummary'] as const;

export type ProFeature = typeof PRO_FEATURES[number];

// Always true until the paywall ships. The team (id or object) is a parameter
// so call sites already pass what a real per-team check will need.
export function teamHasPro(_team?: { id: string } | string | null): boolean {
  return true;
}

export const hasProFeature = (team: Parameters<typeof teamHasPro>[0], _feature: ProFeature) => teamHasPro(team);
