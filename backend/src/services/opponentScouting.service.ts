import { buildDetailedHeatmap, DetailedZoneStats } from '../lib/heatmap';

export interface JerseyTally {
  jerseyNumber: number;
  kills: number;
  aces: number;
  errors: number;
}

export interface OpponentScoutingReport {
  insufficientData: false;
  totalEvents: number;
  zoneBreakdown: DetailedZoneStats;
  dominantErrorType: string | null;
  dominantErrorCount: number;
  jerseyTallies: JerseyTally[] | null; // null when no jersey numbers were captured
}

export interface OpponentScoutingInsufficient {
  insufficientData: true;
  totalEvents: number;
}

export type OpponentScoutingResult = OpponentScoutingReport | OpponentScoutingInsufficient;

const MIN_EVENTS = 10;

const ERROR_TYPES = ['ATTACK_ERROR', 'SERVICE_ERROR', 'BLOCK_ERROR', 'DIG_ERROR', 'SETTING_ERROR'] as const;

export function generateOpponentScoutingReport(
  events: { courtZone: number | null; eventType: string; opponentJerseyNumber: number | null }[],
): OpponentScoutingResult {
  if (events.length < MIN_EVENTS) {
    return { insufficientData: true, totalEvents: events.length };
  }

  // Zone breakdown reuses the shared heatmap builder — it already works for any event array.
  const zoneBreakdown = buildDetailedHeatmap(events);

  // Dominant error type
  const errorCounts: Record<string, number> = {};
  for (const e of events) {
    if ((ERROR_TYPES as readonly string[]).includes(e.eventType)) {
      errorCounts[e.eventType] = (errorCounts[e.eventType] ?? 0) + 1;
    }
  }
  let dominantErrorType: string | null = null;
  let dominantErrorCount = 0;
  for (const [type, count] of Object.entries(errorCounts)) {
    if (count > dominantErrorCount) {
      dominantErrorCount = count;
      dominantErrorType = type;
    }
  }

  // Per-jersey tallies — only if at least one event has a jersey number
  const jerseyMap = new Map<number, { kills: number; aces: number; errors: number }>();
  for (const e of events) {
    if (e.opponentJerseyNumber == null) continue;
    const n = e.opponentJerseyNumber;
    if (!jerseyMap.has(n)) jerseyMap.set(n, { kills: 0, aces: 0, errors: 0 });
    const tally = jerseyMap.get(n)!;
    if (e.eventType === 'KILL') tally.kills++;
    else if (e.eventType === 'ACE') tally.aces++;
    else if ((ERROR_TYPES as readonly string[]).includes(e.eventType)) tally.errors++;
  }

  const jerseyTallies: JerseyTally[] | null =
    jerseyMap.size === 0
      ? null
      : Array.from(jerseyMap.entries())
          .map(([jerseyNumber, t]) => ({ jerseyNumber, ...t }))
          .sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  return {
    insufficientData: false,
    totalEvents: events.length,
    zoneBreakdown,
    dominantErrorType,
    dominantErrorCount,
    jerseyTallies,
  };
}
