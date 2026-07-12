import type { StatLine } from '../lib/analytics';

// ─── Thresholds ───────────────────────────────────────────────────────────────
// Exact values mirrored from coachingRecommendations.service.ts so both
// surfaces give players and coaches a consistent picture of "healthy".

const ATTACK_STRENGTH  = 0.250; // hitting % at or above → strength
const ATTACK_WEAKNESS  = 0.150; // hitting % strictly below → weakness (medium warning)

const SERVE_STRENGTH   = 0.08;  // error rate at or below → strength (elite floor)
const SERVE_WEAKNESS   = 0.12;  // error rate strictly above → weakness (medium warning)

const PASS_STRENGTH    = 2.00;  // rating at or above → strength (healthy baseline)
const PASS_WEAKNESS    = 1.50;  // rating strictly below → weakness (high-priority threshold)

const DEFENCE_STRENGTH = 0.10;  // dig error rate at or below → strength
const DEFENCE_WEAKNESS = 0.20;  // dig error rate strictly above → weakness (medium warning)

// Minimum completed matches to compute a trend; split into two WINDOW_SIZE halves.
const MIN_MATCHES_FOR_TREND = 6;
const WINDOW_SIZE           = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerDevelopmentReport {
  strengths:      string[];
  weaknesses:     string[];
  mostImproved:   { category: string; change: string } | null;
  needsAttention: { category: string; change: string } | null;
  trend:          'improving' | 'declining' | 'stable' | 'insufficient_data';
}

export interface MatchStatEntry {
  matchDate: Date;
  stats: StatLine;
}

// ─── Window metric helpers ────────────────────────────────────────────────────
// Each aggregates a window of matches into one number, or null when there are
// fewer than 5 total opportunities (too noisy to evaluate).

function windowAttack(entries: MatchStatEntry[]): number | null {
  const attempts = entries.reduce((s, e) => s + e.stats.attackAttempts, 0);
  if (attempts < 5) return null;
  const kills  = entries.reduce((s, e) => s + e.stats.kills, 0);
  const errors = entries.reduce((s, e) => s + e.stats.attackErrors, 0);
  return (kills - errors) / attempts;
}

function windowServeErrorRate(entries: MatchStatEntry[]): number | null {
  const attempts = entries.reduce((s, e) => s + e.stats.serveAttempts, 0);
  if (attempts < 5) return null;
  const errors = entries.reduce((s, e) => s + e.stats.serviceErrors, 0);
  return errors / attempts;
}

function windowPassRating(entries: MatchStatEntry[]): number | null {
  const attempts = entries.reduce((s, e) => s + e.stats.passAttempts, 0);
  if (attempts < 5) return null;
  // Weighted average: each match contributes its rating × its attempt count.
  const weightedSum = entries.reduce((s, e) =>
    s + (e.stats.passAttempts > 0 && e.stats.passingRating !== null
      ? e.stats.passingRating * e.stats.passAttempts
      : 0), 0);
  return weightedSum / attempts;
}

function windowDigErrorRate(entries: MatchStatEntry[]): number | null {
  const digs      = entries.reduce((s, e) => s + e.stats.digs, 0);
  const digErrors = entries.reduce((s, e) => s + e.stats.digErrors, 0);
  const total = digs + digErrors;
  if (total < 5) return null;
  return digErrors / total;
}

// ─── Category definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  name:         string;
  metric:       (entries: MatchStatEntry[]) => number | null;
  higherBetter: boolean; // false for error-rate categories (lower = better)
  strength:     number;
  weakness:     number;
  format:       (v: number) => string;
}

const CATEGORIES: CategoryDef[] = [
  {
    name: 'Attack',
    metric: windowAttack,
    higherBetter: true,
    strength: ATTACK_STRENGTH,
    weakness: ATTACK_WEAKNESS,
    format: (v) => v.toFixed(3),
  },
  {
    name: 'Serve',
    metric: windowServeErrorRate,
    higherBetter: false,
    strength: SERVE_STRENGTH,
    weakness: SERVE_WEAKNESS,
    format: (v) => `${Math.round(v * 100)}% error rate`,
  },
  {
    name: 'Pass',
    metric: windowPassRating,
    higherBetter: true,
    strength: PASS_STRENGTH,
    weakness: PASS_WEAKNESS,
    format: (v) => v.toFixed(2),
  },
  {
    name: 'Defence',
    metric: windowDigErrorRate,
    higherBetter: false,
    strength: DEFENCE_STRENGTH,
    weakness: DEFENCE_WEAKNESS,
    format: (v) => `${Math.round(v * 100)}% dig error rate`,
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePlayerDevelopmentReport(
  matchStats: MatchStatEntry[],
): PlayerDevelopmentReport {
  const sorted = [...matchStats].sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());

  if (sorted.length < MIN_MATCHES_FOR_TREND) {
    return { strengths: [], weaknesses: [], mostImproved: null, needsAttention: null,
             trend: 'insufficient_data' };
  }

  const prior  = sorted.slice(sorted.length - MIN_MATCHES_FOR_TREND, sorted.length - WINDOW_SIZE);
  const recent = sorted.slice(sorted.length - WINDOW_SIZE);

  const strengths:  string[] = [];
  const weaknesses: string[] = [];

  type Delta = { category: string; delta: number; recentVal: number; priorVal: number };
  const deltas: Delta[] = [];

  for (const cat of CATEGORIES) {
    const recentVal = cat.metric(recent);
    const priorVal  = cat.metric(prior);

    if (recentVal !== null) {
      if (cat.higherBetter) {
        if (recentVal >= cat.strength)  strengths.push(cat.name);
        else if (recentVal < cat.weakness) weaknesses.push(cat.name);
      } else {
        if (recentVal <= cat.strength)  strengths.push(cat.name);
        else if (recentVal > cat.weakness) weaknesses.push(cat.name);
      }
    }

    if (recentVal !== null && priorVal !== null) {
      // Positive signed delta always means improvement regardless of direction.
      const signed = cat.higherBetter ? recentVal - priorVal : priorVal - recentVal;
      deltas.push({ category: cat.name, delta: signed, recentVal, priorVal });
    }
  }

  const improved = deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta);
  const declined = deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta);

  const trend: PlayerDevelopmentReport['trend'] =
    improved.length > declined.length ? 'improving' :
    declined.length > improved.length ? 'declining' : 'stable';

  return {
    strengths,
    weaknesses,
    mostImproved:   improved.length > 0
      ? changeLabel(improved[0], CATEGORIES.find((c) => c.name === improved[0].category)!)
      : null,
    needsAttention: declined.length > 0
      ? changeLabel(declined[0], CATEGORIES.find((c) => c.name === declined[0].category)!)
      : null,
    trend,
  };
}

function changeLabel(
  d: { category: string; delta: number; recentVal: number; priorVal: number },
  cat: CategoryDef,
): { category: string; change: string } {
  return {
    category: d.category,
    change: `${d.delta > 0 ? '↑' : '↓'} ${cat.format(d.priorVal)} → ${cat.format(d.recentVal)}`,
  };
}
