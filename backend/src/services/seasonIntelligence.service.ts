// Mirrors the shape produced by getTeamTrends in controllers/analytics.ts
// and the TeamTrend interface in frontend/src/lib/api.ts.
export interface TeamTrend {
  matchId: string;
  opponent: string;
  matchDate: Date | string;
  kills: number;
  aces: number;
  blocks: number;
  digs: number;
  hittingPercentage: number | null;
}

export interface SeasonInsight {
  category: 'kills' | 'aces' | 'blocks' | 'digs' | 'hittingPercentage';
  message: string;
  direction: 'positive' | 'negative';
}

export interface SeasonIntelligenceReport {
  seasonAverages: {
    kills: number;
    aces: number;
    blocks: number;
    digs: number;
    hittingPercentage: number | null;
  };
  insights: SeasonInsight[];
  trajectory: 'improving' | 'declining' | 'mixed' | 'insufficient_data';
}

// Minimum matches required before trend analysis is meaningful.
const MIN_MATCHES = 5;
// Window size for recent-vs-prior trajectory comparison (mirrors playerDevelopment.service.ts).
const WINDOW = 3;

type MetricKey = 'kills' | 'aces' | 'blocks' | 'digs' | 'hittingPercentage';

const METRIC_LABELS: Record<MetricKey, string> = {
  kills:            'Kills',
  aces:             'Service aces',
  blocks:           'Blocks',
  digs:             'Digs',
  hittingPercentage:'Hitting percentage',
};

// ─── Streak detection ─────────────────────────────────────────────────────────
// Returns the longest strictly-monotonic run of ≥ 3 consecutive matches for a
// single metric. Null values (hittingPct when there were no attacks) break the
// streak. When both an increasing and decreasing streak of the same length
// exist, the positive one is reported.

function detectLongestStreak(
  values: (number | null)[],
): { length: number; direction: 'up' | 'down' } | null {
  let bestUp = 1, bestDown = 1;
  let curUp  = 1, curDown  = 1;

  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (prev === null || curr === null) {
      curUp = 1; curDown = 1; continue;
    }
    if (curr > prev)      { curUp++;  curDown = 1; }
    else if (curr < prev) { curDown++; curUp  = 1; }
    else                  { curUp  = 1; curDown = 1; } // equal breaks streak
    if (curUp   > bestUp)   bestUp   = curUp;
    if (curDown > bestDown) bestDown = curDown;
  }

  if (bestUp >= 3 || bestDown >= 3) {
    // Prefer positive (up) when tied
    if (bestUp >= bestDown) return { length: bestUp,   direction: 'up'   };
    else                    return { length: bestDown,  direction: 'down' };
  }
  return null;
}

// ─── Window average ───────────────────────────────────────────────────────────

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateSeasonIntelligence(trends: TeamTrend[]): SeasonIntelligenceReport {
  // Season averages are always computed from available data, even if < MIN_MATCHES.
  const seasonAverages = {
    kills:            avg(trends.map((t) => t.kills))            ?? 0,
    aces:             avg(trends.map((t) => t.aces))             ?? 0,
    blocks:           avg(trends.map((t) => t.blocks))           ?? 0,
    digs:             avg(trends.map((t) => t.digs))             ?? 0,
    hittingPercentage:avg(trends.map((t) => t.hittingPercentage)),
  };

  if (trends.length < MIN_MATCHES) {
    return { seasonAverages, insights: [], trajectory: 'insufficient_data' };
  }

  const metrics: MetricKey[] = ['kills', 'aces', 'blocks', 'digs', 'hittingPercentage'];

  // ── Streak insights ──────────────────────────────────────────────────────────
  const insights: SeasonInsight[] = [];

  for (const key of metrics) {
    const values = trends.map((t) => t[key] as number | null);
    const streak = detectLongestStreak(values);
    if (!streak) continue;

    const label = METRIC_LABELS[key];
    const direction: SeasonInsight['direction'] = streak.direction === 'up' ? 'positive' : 'negative';
    const verb = streak.direction === 'up' ? 'improved' : 'declined';

    insights.push({
      category: key,
      direction,
      message: `${label} has ${verb} for ${streak.length} consecutive matches.`,
    });
  }

  // ── Trajectory (recent WINDOW vs prior WINDOW) ───────────────────────────────
  // Use the last WINDOW matches as "recent" and up to WINDOW matches before that
  // as "prior". With fewer than WINDOW*2 matches the prior window is smaller but
  // still valid for comparison.
  const recent = trends.slice(-WINDOW);
  const prior  = trends.slice(Math.max(0, trends.length - WINDOW * 2), trends.length - WINDOW);

  let improved = 0, declined = 0;

  for (const key of metrics) {
    const recentAvg = avg(recent.map((t) => t[key] as number | null));
    const priorAvg  = avg(prior.map((t) => t[key] as number | null));
    if (recentAvg === null || priorAvg === null) continue;
    if (recentAvg > priorAvg) improved++;
    else if (recentAvg < priorAvg) declined++;
  }

  const trajectory: SeasonIntelligenceReport['trajectory'] =
    improved > declined ? 'improving' :
    declined > improved ? 'declining' : 'mixed';

  return { seasonAverages, insights, trajectory };
}
