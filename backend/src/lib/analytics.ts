import { EventType, Position } from '@prisma/client';

export interface AnalyticsEvent {
  eventType: EventType;
  playerId: string | null; // null for opponent events (isOpponentEvent=true)
  setNumber: number;
}

export interface AnalyticsPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: Position;
}

export interface StatLine {
  totalEvents: number;
  kills: number;
  attackErrors: number;
  attackAttempts: number;
  hittingPercentage: number | null;
  aces: number;
  serviceErrors: number;
  serveAttempts: number;
  serveInPercentage: number | null;
  passAttempts: number;
  passingRating: number | null;
  soloBlocks: number;
  blockAssists: number;
  totalBlocks: number;
  blockErrors: number;
  digs: number;
  digErrors: number;
  assists: number;
  settingErrors: number;
}

export interface PlayerStatLine extends StatLine {
  player: AnalyticsPlayer;
}

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function count(events: AnalyticsEvent[], eventType: EventType) {
  return events.reduce((total, event) => total + Number(event.eventType === eventType), 0);
}

export function calculateStats(events: AnalyticsEvent[]): StatLine {
  const kills = count(events, EventType.KILL);
  const attackErrors = count(events, EventType.ATTACK_ERROR);
  const attackAttempts = kills + attackErrors + count(events, EventType.ATTACK_ATTEMPT);
  const aces = count(events, EventType.ACE);
  const serviceErrors = count(events, EventType.SERVICE_ERROR);
  const serveAttempts = aces + serviceErrors + count(events, EventType.SERVE_IN);
  const pass3 = count(events, EventType.PASS_3);
  const pass2 = count(events, EventType.PASS_2);
  const pass1 = count(events, EventType.PASS_1);
  const pass0 = count(events, EventType.PASS_0);
  const passAttempts = pass3 + pass2 + pass1 + pass0;
  const soloBlocks = count(events, EventType.SOLO_BLOCK);
  const blockAssists = count(events, EventType.BLOCK_ASSIST);

  return {
    totalEvents: events.length,
    kills,
    attackErrors,
    attackAttempts,
    hittingPercentage:
      attackAttempts > 0 ? round((kills - attackErrors) / attackAttempts) : null,
    aces,
    serviceErrors,
    serveAttempts,
    serveInPercentage:
      serveAttempts > 0 ? round((serveAttempts - serviceErrors) / serveAttempts) : null,
    passAttempts,
    passingRating:
      passAttempts > 0 ? round((pass3 * 3 + pass2 * 2 + pass1) / passAttempts, 2) : null,
    soloBlocks,
    blockAssists,
    totalBlocks: round(soloBlocks + blockAssists * 0.5, 1),
    blockErrors: count(events, EventType.BLOCK_ERROR),
    digs: count(events, EventType.DIG),
    digErrors: count(events, EventType.DIG_ERROR),
    assists: count(events, EventType.ASSIST),
    settingErrors: count(events, EventType.SETTING_ERROR),
  };
}

export function calculatePlayerStats(
  players: AnalyticsPlayer[],
  events: AnalyticsEvent[]
): PlayerStatLine[] {
  const ownEvents = events.filter((e): e is AnalyticsEvent & { playerId: string } => e.playerId != null);
  return players
    .map((player) => ({
      player,
      ...calculateStats(ownEvents.filter((event) => event.playerId === player.id)),
    }))
    .sort((a, b) => b.totalEvents - a.totalEvents || a.player.jerseyNumber - b.player.jerseyNumber);
}

export function calculateSetStats(events: AnalyticsEvent[]) {
  const setNumbers = [...new Set(events.map((event) => event.setNumber))].sort((a, b) => a - b);
  return setNumbers.map((setNumber) => ({
    setNumber,
    ...calculateStats(events.filter((event) => event.setNumber === setNumber)),
  }));
}
