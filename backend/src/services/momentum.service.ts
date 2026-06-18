import { HOME_POINT_SET, AWAY_POINT_SET } from '../lib/scoringRules';

export interface MomentumEvent {
  eventType: string;
  setNumber: number;
  recordedAt: Date;
}

export interface MomentumPoint {
  pointNumber: number;
  scorer: 'home' | 'away';
  homeScore: number;
  awayScore: number;
  lead: number;
  setNumber: number;
  runLength: number;
}

export interface MomentumStats {
  totalPoints: number;
  longestHomeRun: number;
  longestAwayRun: number;
  longestRun: number;
  leadChanges: number;
  largestHomeLead: number;
  largestAwayLead: number;
}

export interface SignificantRun {
  team: 'home' | 'away';
  length: number;
  startPoint: number;
}

export interface MomentumResult {
  timeline: MomentumPoint[];
  stats: MomentumStats;
  significantRuns: SignificantRun[];
}

export function calculateMomentum(events: MomentumEvent[]): MomentumResult {
  const scoringEvents = events.filter(
    (e) => HOME_POINT_SET.has(e.eventType) || AWAY_POINT_SET.has(e.eventType),
  );

  let homeScore = 0;
  let awayScore = 0;
  let currentRunTeam: 'home' | 'away' | null = null;
  let currentRunLength = 0;
  let longestHomeRun = 0;
  let longestAwayRun = 0;
  let leadChanges = 0;
  let largestHomeLead = 0;
  let largestAwayLead = 0;
  let prevLead = 0;

  const timeline: MomentumPoint[] = [];

  for (let i = 0; i < scoringEvents.length; i++) {
    const e = scoringEvents[i];
    const scorer: 'home' | 'away' = HOME_POINT_SET.has(e.eventType) ? 'home' : 'away';

    if (scorer === 'home') homeScore++;
    else awayScore++;

    currentRunLength = scorer === currentRunTeam ? currentRunLength + 1 : 1;
    currentRunTeam = scorer;

    if (scorer === 'home') longestHomeRun = Math.max(longestHomeRun, currentRunLength);
    else longestAwayRun = Math.max(longestAwayRun, currentRunLength);

    const lead = homeScore - awayScore;
    if (prevLead !== 0 && Math.sign(lead) !== Math.sign(prevLead)) leadChanges++;

    largestHomeLead = Math.max(largestHomeLead, lead);
    largestAwayLead = Math.max(largestAwayLead, -lead);
    prevLead = lead;

    timeline.push({
      pointNumber: i + 1,
      scorer,
      homeScore,
      awayScore,
      lead,
      setNumber: e.setNumber,
      runLength: currentRunLength,
    });
  }

  // Extract significant runs (3+ consecutive)
  const runs: SignificantRun[] = [];
  let runStart = 0;
  for (let i = 0; i < timeline.length; i++) {
    if (i === 0 || timeline[i].scorer !== timeline[i - 1].scorer) runStart = i;
    if (timeline[i].runLength >= 3) {
      const existing = runs.find((r) => r.startPoint === runStart + 1);
      if (!existing) {
        runs.push({ team: timeline[i].scorer, length: timeline[i].runLength, startPoint: runStart + 1 });
      } else {
        existing.length = timeline[i].runLength;
      }
    }
  }

  return {
    timeline,
    stats: {
      totalPoints: scoringEvents.length,
      longestHomeRun,
      longestAwayRun,
      longestRun: Math.max(longestHomeRun, longestAwayRun),
      leadChanges,
      largestHomeLead,
      largestAwayLead,
    },
    significantRuns: runs.filter((r) => r.length >= 3).slice(0, 10),
  };
}
