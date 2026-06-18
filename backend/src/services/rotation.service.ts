import { HOME_POINT_SET, AWAY_POINT_SET } from '../lib/scoringRules';

export interface RotationEvent {
  eventType: string;
  rotationNumber: number | null;
}

export interface RotationStat {
  rotation: number;
  won: number;
  lost: number;
  total: number;
  net: number;
  efficiency: number | null;
}

export interface RotationInsights {
  best: RotationStat | null;
  worst: RotationStat | null;
  highestSideOut: RotationStat | null;
  lowestSideOut: RotationStat | null;
}

export interface RotationResult {
  rotations: RotationStat[];
  insights: RotationInsights;
}

export function calculateRotations(events: RotationEvent[]): RotationResult {
  const counts: Record<number, { won: number; lost: number }> = {};
  for (let r = 1; r <= 6; r++) counts[r] = { won: 0, lost: 0 };

  for (const e of events) {
    if (e.rotationNumber == null || e.rotationNumber < 1 || e.rotationNumber > 6) continue;
    if (HOME_POINT_SET.has(e.eventType)) counts[e.rotationNumber].won++;
    else if (AWAY_POINT_SET.has(e.eventType)) counts[e.rotationNumber].lost++;
  }

  const rotations: RotationStat[] = Object.entries(counts).map(([rot, { won, lost }]) => ({
    rotation: Number(rot),
    won,
    lost,
    total: won + lost,
    net: won - lost,
    efficiency: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
  }));

  const withData = rotations.filter((r) => r.total > 0);

  return {
    rotations,
    insights: {
      best: withData.length ? withData.reduce((a, b) => (b.net > a.net ? b : a)) : null,
      worst: withData.length ? withData.reduce((a, b) => (b.net < a.net ? b : a)) : null,
      highestSideOut: withData.length
        ? withData.reduce((a, b) => ((b.efficiency ?? -1) > (a.efficiency ?? -1) ? b : a))
        : null,
      lowestSideOut: withData.length
        ? withData.reduce((a, b) => ((b.efficiency ?? 101) < (a.efficiency ?? 101) ? b : a))
        : null,
    },
  };
}
