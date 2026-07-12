import type { TeamInsight } from '../types';
import type { TeamTrend } from './api';

export function generateTeamInsights(
  trends: TeamTrend[]
): TeamInsight[] {
  if (trends.length < 2) return [];

  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];

  const insights: TeamInsight[] = [];

  // Brand voice: every claim carries a number; dips are framed as the next
  // area to attack, never as failure.
  const compare = (
    label: string,
    current: number,
    previousValue: number
  ) => {
    const diff = current - previousValue;

    if (diff > 0) {
      insights.push({
        type: 'positive',
        message: `${label} up ${diff} on last match (${previousValue} → ${current}). Keep the pressure on.`,
      });
    }

    if (diff < 0) {
      insights.push({
        type: 'warning',
        message: `${label} down ${Math.abs(diff)} on last match (${previousValue} → ${current}) — an area to attack next.`,
      });
    }
  };

  compare('Kills', latest.kills, previous.kills);
  compare('Aces', latest.aces, previous.aces);
  compare('Blocks', latest.blocks, previous.blocks);
  compare('Digs', latest.digs, previous.digs);

  return insights;
}