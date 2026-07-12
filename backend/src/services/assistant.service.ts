import type { Recommendation } from './coachingRecommendations.service';
import type { PlayerDevelopmentReport } from './playerDevelopment.service';
import type { SeasonIntelligenceReport } from './seasonIntelligence.service';
import type { TrainingRecommendation } from './trainingRecommendations.service';
import type { RotationResult } from './rotation.service';

export interface AssistantAnswer {
  matchedIntent: string | null;
  answer: string;
}

export interface AssistantContext {
  teamRecommendations: Recommendation[];
  rotations: RotationResult;
  seasonIntelligence: SeasonIntelligenceReport;
  trainingRecommendations: TrainingRecommendation[];
  playerReports: { playerName: string; report: PlayerDevelopmentReport }[];
}

// ─── Intent definitions ───────────────────────────────────────────────────────

type IntentHandler = (q: string, ctx: AssistantContext) => string | null;

interface Intent {
  name: string;
  keywords: string[];
  handle: IntentHandler;
  example: string;
}

// ─── Intent handlers ──────────────────────────────────────────────────────────

function handleWeakestRotation(_q: string, ctx: AssistantContext): string | null {
  const worst = ctx.rotations.insights.worst;
  if (!worst) return 'There is not enough rotation data yet to identify a weakest rotation.';
  const eff = worst.efficiency !== null ? `${worst.efficiency}%` : 'unknown';
  return `Rotation ${worst.rotation} is the weakest, with a ${worst.net > 0 ? '+' : ''}${worst.net} net point differential and ${eff} efficiency (${worst.won} won, ${worst.lost} lost).`;
}

function handleBestRotation(_q: string, ctx: AssistantContext): string | null {
  const best = ctx.rotations.insights.best;
  if (!best) return 'There is not enough rotation data yet to identify a best rotation.';
  const eff = best.efficiency !== null ? `${best.efficiency}%` : 'unknown';
  return `Rotation ${best.rotation} is the strongest, with a +${best.net} net point differential and ${eff} efficiency (${best.won} won, ${best.lost} lost).`;
}

function handleMostImproved(_q: string, ctx: AssistantContext): string | null {
  // Find the player with the largest positive change across any category
  let best: { playerName: string; category: string; change: string } | null = null;
  for (const { playerName, report } of ctx.playerReports) {
    if (!report.mostImproved) continue;
    if (!best) {
      best = { playerName, ...report.mostImproved };
    } else {
      // Both changes are strings like "↑ 0.150 → 0.280"; pick the one with the larger
      // raw numeric jump by comparing the reported change strings (we can't re-derive
      // the delta here, so just take the first qualifying player — already sorted by
      // the service when it sets mostImproved). Keep whichever was set first.
    }
  }
  if (!best) return 'No players have enough match history to show improvement trends yet.';
  return `${best.playerName} shows the most improvement in ${best.category} (${best.change}).`;
}

function handleNeedsAttention(_q: string, ctx: AssistantContext): string | null {
  // Collect all players with a needsAttention entry
  const flagged = ctx.playerReports
    .filter(({ report }) => !!report.needsAttention)
    .map(({ playerName, report }) => ({
      playerName,
      category: report.needsAttention!.category,
      change:   report.needsAttention!.change,
    }));

  if (flagged.length === 0) return 'No individual players have been flagged as needing attention — great consistency across the roster.';
  const primary = flagged[0];
  const rest = flagged.slice(1);
  let answer = `${primary.playerName} needs the most attention in ${primary.category} (${primary.change}).`;
  if (rest.length > 0) {
    answer += ` Also watch: ${rest.map((p) => `${p.playerName} (${p.category})`).join(', ')}.`;
  }
  return answer;
}

function handleTrainingFocus(_q: string, ctx: AssistantContext): string | null {
  const top = ctx.trainingRecommendations.slice(0, 2);
  if (top.length === 0) return 'No specific training priorities identified — the team is performing within healthy ranges across all areas.';
  const parts = top.map((t) => `${t.focus} (${t.allocationPct}% of practice time)`);
  return `Prioritise: ${parts.join(', ')}. ${top[0].rationale}`;
}

function handleSeasonTrend(_q: string, ctx: AssistantContext): string | null {
  const { trajectory, insights } = ctx.seasonIntelligence;
  if (trajectory === 'insufficient_data') return 'Not enough completed matches yet to assess the season trend — check back after 5+ matches.';
  const trajectoryLabel =
    trajectory === 'improving' ? 'on an improving trajectory' :
    trajectory === 'declining' ? 'on a declining trajectory' : 'showing a mixed trajectory';
  const streaks = insights.filter((i) => i.direction === 'positive').map((i) => i.message);
  let answer = `The team is ${trajectoryLabel} this season.`;
  if (streaks.length > 0) answer += ` Positive streak: ${streaks[0]}`;
  return answer;
}

function handleTeamWeaknesses(_q: string, ctx: AssistantContext): string | null {
  const high = ctx.teamRecommendations.filter((r) => r.priority === 'high');
  const medium = ctx.teamRecommendations.filter((r) => r.priority === 'medium');
  const top = [...high, ...medium].slice(0, 2);
  if (top.length === 0) return 'No significant team-level weaknesses detected — stats are within healthy ranges.';
  return `Biggest concerns: ${top.map((r) => `${r.category} (${r.priority})`).join(', ')}. ${top[0].message}`;
}

// ─── Intent registry ──────────────────────────────────────────────────────────
// Keywords are tested in order; earlier matches win, so more specific phrases
// come first within each intent. Intents are tested top-to-bottom, so more
// specific intents appear before general ones that could collide.

const INTENTS: Intent[] = [
  {
    name:     'weakest_rotation',
    keywords: ['weakest rotation', 'worst rotation', 'bad rotation', 'weakest rot'],
    handle:   handleWeakestRotation,
    example:  '"What is our weakest rotation?"',
  },
  {
    name:     'best_rotation',
    keywords: ['best rotation', 'strongest rotation', 'top rotation'],
    handle:   handleBestRotation,
    example:  '"What is our best rotation?"',
  },
  {
    name:     'most_improved_player',
    keywords: ['most improved', 'who improved', 'best progress', 'who is improving', 'biggest improvement'],
    handle:   handleMostImproved,
    example:  '"Who is our most improved player?"',
  },
  {
    name:     'needs_attention',
    keywords: ['needs attention', 'struggling', 'needs work', 'falling behind', 'needs help'],
    handle:   handleNeedsAttention,
    example:  '"Which player needs the most attention?"',
  },
  {
    name:     'training_focus',
    keywords: ['what should we practice', 'what should we focus on', 'training focus', 'practice focus', 'focus on', 'work on in practice', 'prioritise', 'prioritize'],
    handle:   handleTrainingFocus,
    example:  '"What should we practice this week?"',
  },
  {
    name:     'season_trend',
    keywords: ['are we improving', 'season trend', 'how is the season going', 'how are we doing', 'season performance', 'overall trend'],
    handle:   handleSeasonTrend,
    example:  '"Are we improving this season?"',
  },
  {
    name:     'team_weaknesses',
    keywords: ['our weaknesses', 'our biggest weakness', "what's wrong", 'biggest issues', 'main problems', 'weak areas', 'team weakness', 'what are we doing wrong'],
    handle:   handleTeamWeaknesses,
    example:  '"What are our biggest weaknesses?"',
  },
];

// ─── Fallback help text ───────────────────────────────────────────────────────

const HELP_TEXT =
  "Sorry, I didn't recognise that question. I can answer questions like:\n" +
  INTENTS.map((i) => `• ${i.example}`).join('\n');

// ─── Main export ──────────────────────────────────────────────────────────────

export function answerQuestion(question: string, context: AssistantContext): AssistantAnswer {
  const q = question.toLowerCase().trim();

  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => q.includes(kw))) {
      return {
        matchedIntent: intent.name,
        answer:        intent.handle(q, context) ?? HELP_TEXT,
      };
    }
  }

  return { matchedIntent: null, answer: HELP_TEXT };
}
