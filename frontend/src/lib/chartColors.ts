// Brand chart palette, tuned for LIGHT backgrounds (light mode is now default).
// Source: docs/brand/BRAND-GUIDELINES.md §2 (chart palette + semantic colours).
// Components must import from here — no hardcoded hexes in chart code.
//
// Semantic colours use the DEFAULT tones, not the `-dark` on-dark variants:
// the brighter variants lose contrast against white/grey-50.
export const CHART_SERIES = ['#FFB81C', '#33477A', '#2B7FD4', '#7A5FB8', '#9AA1AD', '#8FA0C4'];
export const CHART_POSITIVE = '#2E9E5B'; // success DEFAULT
export const CHART_NEGATIVE = '#D64545'; // error DEFAULT
export const CHART_GRID = '#E2E5EA';     // grey-200
export const CHART_TICK = '#5A6270';     // grey-600
export const CHART_REFERENCE = '#9AA1AD'; // grey-400
export const CHART_TOOLTIP_BG = '#FFFFFF';
export const CHART_TOOLTIP_TEXT = '#1A1D23'; // grey-900
export const CHART_COURT_BG = '#F6F7F9'; // grey-50 — court diagram background
export const CHART_EMPTY = '#E2E5EA';    // grey-200 — zero/empty state marks
