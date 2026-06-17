import type { TeamInsight } from '../types';
import type { TeamTrend } from './api';

export function generateTeamInsights(
  trends: TeamTrend[]
): TeamInsight[] {
  if (trends.length < 2) return [];

  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];

  const insights: TeamInsight[] = [];

  const compare = (
    label: string,
    current: number,
    previousValue: number
  ) => {
    const diff = current - previousValue;

    if (diff > 0) {
      insights.push({
        type: 'positive',
        message: `${label} improved by ${diff}`,
      });
    }

    if (diff < 0) {
      insights.push({
        type: 'warning',
        message: `${label} decreased by ${Math.abs(diff)}`,
      });
    }
  };

  compare('Kills', latest.kills, previous.kills);
  compare('Aces', latest.aces, previous.aces);
  compare('Blocks', latest.blocks, previous.blocks);
  compare('Digs', latest.digs, previous.digs);

  return insights;
}