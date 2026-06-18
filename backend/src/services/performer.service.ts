// Stat weighting for MVP/top-performer selection.
// Weights reflect impact value per event in a volleyball context.
// Adjust here when Phase 5 introduces ML-based weighting.
export const PERFORMER_WEIGHTS: Record<string, number> = {
  KILL: 2,
  ACE: 2,
  SOLO_BLOCK: 1.5,
  BLOCK_ASSIST: 0.75,
  DIG: 0.5,
  ASSIST: 0.5,
};

export interface PerformerPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: string;
}

export interface PerformerEvent {
  eventType: string;
  playerId: string;
}

export interface TopPerformerResult {
  player: PerformerPlayer;
  kills: number;
  aces: number;
  blocks: number;
  digs: number;
  assists: number;
  score: number;
}

function countFor(pid: string, eventType: string, events: PerformerEvent[]): number {
  return events.filter((e) => e.playerId === pid && e.eventType === eventType).length;
}

export function calculateCompositeScore(playerId: string, events: PerformerEvent[]): number {
  return Object.entries(PERFORMER_WEIGHTS).reduce(
    (total, [type, weight]) => total + countFor(playerId, type, events) * weight,
    0,
  );
}

export function selectTopPerformer(
  players: PerformerPlayer[],
  events: PerformerEvent[],
): TopPerformerResult | null {
  if (!players.length || !events.length) return null;

  const ranked = players
    .map((p) => ({ player: p, score: calculateCompositeScore(p.id, events) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;

  const { player, score } = ranked[0];

  return {
    player,
    score,
    kills: countFor(player.id, 'KILL', events),
    aces: countFor(player.id, 'ACE', events),
    blocks:
      countFor(player.id, 'SOLO_BLOCK', events) +
      countFor(player.id, 'BLOCK_ASSIST', events) * 0.5,
    digs: countFor(player.id, 'DIG', events),
    assists: countFor(player.id, 'ASSIST', events),
  };
}
