import type { StatLine } from '../lib/analytics';
import type { RotationResult } from './rotation.service';
import type { DetailedZoneStats } from '../lib/heatmap';

export interface Recommendation {
  category: 'attack' | 'serve' | 'pass' | 'defence' | 'rotation';
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export interface CoachingInput {
  stats: StatLine;
  rotations: RotationResult;
  zones: DetailedZoneStats;
}

// Priority ordering for final sort
const PRIORITY_ORDER: Record<Recommendation['priority'], number> = { high: 0, medium: 1, low: 2 };

export function generateCoachingRecommendations(input: CoachingInput): Recommendation[] {
  const recs: Recommendation[] = [];
  const { stats, rotations, zones } = input;

  // ── Attack ──────────────────────────────────────────────────────────────────
  // Minimum 5 attempts before evaluating — too few trials yield noisy percentages.
  if (stats.attackAttempts >= 5 && stats.hittingPercentage !== null) {
    const hp = stats.hittingPercentage;
    if (hp < 0) {
      // Below zero: more errors than kills — actively hurting the team.
      recs.push({
        category: 'attack', priority: 'high',
        message: `Hitting percentage is ${hp.toFixed(3)} — attack errors are outpacing kills. Prioritise shot selection and reduce unforced errors before seeking aggression.`,
      });
    } else if (hp < 0.150) {
      // .000–.149: below the competitive baseline for effective offence.
      recs.push({
        category: 'attack', priority: 'medium',
        message: `Hitting percentage of ${hp.toFixed(3)} is below the .150 competitive baseline. Focus on approach mechanics and cleaner attack execution.`,
      });
    }

    // Zone-specific: flag any zone whose hittingPct is ≥.100 worse than the
    // average across zones with at least 5 attempts. Threshold chosen because
    // a .100 gap is large enough to represent a genuine weak spot, not noise.
    const zonesWith5 = Object.entries(zones.attack).filter(([, z]) => z.attempts >= 5);
    if (zonesWith5.length > 1) {
      const zoneAvg = zonesWith5.reduce((sum, [, z]) => sum + (z.hittingPct ?? 0), 0) / zonesWith5.length;
      for (const [zone, z] of zonesWith5) {
        if (z.hittingPct !== null && z.hittingPct < zoneAvg - 0.100) {
          recs.push({
            category: 'attack', priority: 'medium',
            message: `Zone ${zone} attack efficiency (${z.hittingPct.toFixed(3)}) is significantly below the team zone average (${zoneAvg.toFixed(3)}). Consider redistributing attacks away from Zone ${zone}.`,
          });
        }
      }
    }
  }

  // ── Serve ───────────────────────────────────────────────────────────────────
  // Minimum 5 attempts. Thresholds: >20% error rate is costly (high); >12% warrants
  // attention (medium). Elite teams typically sit below 8-10% error rate.
  if (stats.serveAttempts >= 5) {
    const errorRate = stats.serviceErrors / stats.serveAttempts;
    const pct = Math.round(errorRate * 100);
    if (errorRate > 0.20) {
      recs.push({
        category: 'serve', priority: 'high',
        message: `Service error rate of ${pct}% (${stats.serviceErrors} errors in ${stats.serveAttempts} attempts) is gifting points to the opponent. Prioritise serve consistency over aggression.`,
      });
    } else if (errorRate > 0.12) {
      recs.push({
        category: 'serve', priority: 'medium',
        message: `Service error rate of ${pct}% is above the 12% caution threshold. Monitor serve aggression and reduce unnecessary risk on lower-leverage points.`,
      });
    }
  }

  // ── Pass ────────────────────────────────────────────────────────────────────
  // Rating scale: 0–3. Healthy side-out play needs ≥2.00; below 1.50 is critical
  // because it suggests the team cannot reliably construct an offensive play.
  if (stats.passAttempts >= 5 && stats.passingRating !== null) {
    const rating = stats.passingRating;
    if (rating < 1.50) {
      recs.push({
        category: 'pass', priority: 'high',
        message: `Passing rating of ${rating.toFixed(2)} is critically low (below 1.50). Poor reception is severely limiting offensive options — focus on serve-receive fundamentals immediately.`,
      });
    } else if (rating < 2.00) {
      recs.push({
        category: 'pass', priority: 'medium',
        message: `Passing rating of ${rating.toFixed(2)} is below the 2.00 baseline for effective side-out play. Work on consistent platform mechanics to give the setter better opportunities.`,
      });
    }
  }

  // ── Defence ─────────────────────────────────────────────────────────────────
  // A dig error rate above 20% (1-in-5 defensive contacts ending in error) is
  // the threshold used here; only medium priority since digging is inherently
  // high-variance and a single outlier set can skew the rate.
  const totalDigOpps = stats.digs + stats.digErrors;
  if (totalDigOpps >= 5) {
    const digErrorRate = stats.digErrors / totalDigOpps;
    if (digErrorRate > 0.20) {
      recs.push({
        category: 'defence', priority: 'medium',
        message: `Dig error rate of ${Math.round(digErrorRate * 100)}% (${stats.digErrors} errors in ${totalDigOpps} attempts) exceeds the 20% threshold. Emphasise controlled defensive contacts over aggressive digs.`,
      });
    }
  }

  // ── Rotation ────────────────────────────────────────────────────────────────
  // Only evaluate rotations with ≥5 opportunities (enough to be meaningful).
  // net ≤ -5 across ≥8 opportunities is a serious structural liability (high);
  // net ≤ -3 across ≥5 opportunities warrants attention (medium).
  const rotationsWithData = rotations.rotations.filter((r) => r.total >= 5);
  if (rotationsWithData.length > 0) {
    const worst = rotationsWithData.reduce((a, b) => (b.net < a.net ? b : a));
    if (worst.net <= -5 && worst.total >= 8) {
      recs.push({
        category: 'rotation', priority: 'high',
        message: `Rotation ${worst.rotation} has a net score of ${worst.net} (${worst.won} won, ${worst.lost} lost across ${worst.total} opportunities). This is a significant structural liability — review personnel assignments and tactical coverage for this rotation.`,
      });
    } else if (worst.net <= -3) {
      recs.push({
        category: 'rotation', priority: 'medium',
        message: `Rotation ${worst.rotation} is underperforming with a net score of ${worst.net} (${worst.won}–${worst.lost} across ${worst.total} opportunities). Consider adjustments to serving order or defensive positioning in this rotation.`,
      });
    }
  }

  return recs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
