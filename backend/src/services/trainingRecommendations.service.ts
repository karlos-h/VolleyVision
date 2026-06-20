import type { Recommendation } from './coachingRecommendations.service';
import type { PlayerDevelopmentReport } from './playerDevelopment.service';

export interface TrainingRecommendation {
  focus:         string;
  category:      'attack' | 'serve' | 'pass' | 'defence' | 'rotation' | 'player_development';
  allocationPct: number;
  rationale:     string;
}

export interface TrainingInput {
  teamRecommendations: Recommendation[];
  playerReports?: { playerName: string; report: PlayerDevelopmentReport }[];
}

// Allocation percentages per priority level
const ALLOC: Record<'high' | 'medium' | 'low', number> = { high: 20, medium: 10, low: 5 };

// Maximum total allocation (leave headroom for other practice elements)
const MAX_TOTAL = 60;

// Human-readable focus label per category
const CATEGORY_FOCUS: Record<Recommendation['category'], string> = {
  attack:   'Attack efficiency',
  serve:    'Serve consistency',
  pass:     'Passing fundamentals',
  defence:  'Defensive contacts',
  rotation: 'Rotation coverage',
};

export function generateTrainingRecommendations(input: TrainingInput): TrainingRecommendation[] {
  const { teamRecommendations, playerReports } = input;
  const items: TrainingRecommendation[] = [];

  // ── Team recommendations → training items ───────────────────────────────────
  // Group by category; within each group take the highest priority and merge
  // all rationale text.
  const byCategory = new Map<Recommendation['category'], Recommendation[]>();
  for (const rec of teamRecommendations) {
    const existing = byCategory.get(rec.category) ?? [];
    existing.push(rec);
    byCategory.set(rec.category, existing);
  }

  const PRIORITY_RANK: Record<Recommendation['priority'], number> = { high: 0, medium: 1, low: 2 };

  for (const [category, recs] of byCategory) {
    const sorted = [...recs].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    const topPriority = sorted[0].priority;
    const rationale = sorted.map((r) => r.message).join(' ');
    items.push({
      focus:         CATEGORY_FOCUS[category],
      category,
      allocationPct: ALLOC[topPriority],
      rationale,
    });
  }

  // ── Shared player weaknesses → player_development item ──────────────────────
  // Count players (excluding insufficient_data) that share each weakness category.
  if (playerReports && playerReports.length > 0) {
    const weaknessCounts = new Map<string, { count: number; names: string[] }>();

    for (const { playerName, report } of playerReports) {
      if (report.trend === 'insufficient_data') continue;
      for (const weakness of report.weaknesses) {
        const entry = weaknessCounts.get(weakness) ?? { count: 0, names: [] };
        entry.count++;
        entry.names.push(playerName);
        weaknessCounts.set(weakness, entry);
      }
    }

    for (const [weakness, { count, names }] of weaknessCounts) {
      if (count < 2) continue;
      items.push({
        focus:         `Individual ${weakness.toLowerCase()} development`,
        category:      'player_development',
        allocationPct: 10,
        rationale:     `${count} players (${names.join(', ')}) show below-baseline ${weakness.toLowerCase()} — recommend individual reps targeting this skill area.`,
      });
    }
  }

  if (items.length === 0) return [];

  // ── Cap total at MAX_TOTAL via proportional scaling ──────────────────────────
  const total = items.reduce((s, i) => s + i.allocationPct, 0);
  if (total > MAX_TOTAL) {
    const scale = MAX_TOTAL / total;
    for (const item of items) {
      item.allocationPct = Math.round(item.allocationPct * scale);
    }
    // Correct any rounding drift so the sum stays ≤ MAX_TOTAL
    const rounded = items.reduce((s, i) => s + i.allocationPct, 0);
    if (rounded > MAX_TOTAL) {
      // Shave from the largest item
      items.sort((a, b) => b.allocationPct - a.allocationPct);
      items[0].allocationPct -= (rounded - MAX_TOTAL);
    }
  }

  // ── Sort by allocation descending ────────────────────────────────────────────
  return items.sort((a, b) => b.allocationPct - a.allocationPct);
}
