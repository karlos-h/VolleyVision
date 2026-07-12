import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateOpponentScoutingReport } from '../services/opponentScouting.service';

type InputEvent = { courtZone: number | null; eventType: string; opponentJerseyNumber: number | null };

function makeEvents(overrides: Partial<InputEvent>[], base: InputEvent = { courtZone: 1, eventType: 'KILL', opponentJerseyNumber: null }): InputEvent[] {
  return overrides.map((o) => ({ ...base, ...o }));
}

describe('generateOpponentScoutingReport', () => {
  // ── Insufficient data ────────────────────────────────────────────────────────
  it('returns insufficientData when fewer than 10 events', () => {
    const result = generateOpponentScoutingReport(makeEvents([{}, {}, {}, {}]));
    assert.equal(result.insufficientData, true);
    assert.equal(result.totalEvents, 4);
  });

  it('accepts exactly 10 events as sufficient', () => {
    const events = makeEvents(Array(10).fill({}));
    const result = generateOpponentScoutingReport(events);
    assert.equal(result.insufficientData, false);
  });

  // ── Zone concentration ────────────────────────────────────────────────────────
  it('identifies zone with most kills', () => {
    const events: InputEvent[] = [
      ...Array(8).fill({ courtZone: 4, eventType: 'KILL', opponentJerseyNumber: null }),
      ...Array(3).fill({ courtZone: 2, eventType: 'KILL', opponentJerseyNumber: null }),
    ];
    const result = generateOpponentScoutingReport(events);
    assert.equal(result.insufficientData, false);
    if (result.insufficientData) throw new Error();
    assert.equal(result.zoneBreakdown.attack['4'].kills, 8);
    assert.equal(result.zoneBreakdown.attack['2'].kills, 3);
  });

  // ── Dominant error type ───────────────────────────────────────────────────────
  it('finds dominant error type', () => {
    const events: InputEvent[] = [
      ...Array(5).fill({ courtZone: 1, eventType: 'ATTACK_ERROR', opponentJerseyNumber: null }),
      ...Array(3).fill({ courtZone: 3, eventType: 'SERVICE_ERROR', opponentJerseyNumber: null }),
      ...Array(4).fill({ courtZone: 2, eventType: 'KILL', opponentJerseyNumber: null }),
    ];
    const result = generateOpponentScoutingReport(events);
    assert.equal(result.insufficientData, false);
    if (result.insufficientData) throw new Error();
    assert.equal(result.dominantErrorType, 'ATTACK_ERROR');
    assert.equal(result.dominantErrorCount, 5);
  });

  it('dominantErrorType is null when no errors are recorded', () => {
    const events: InputEvent[] = Array(12).fill({ courtZone: 1, eventType: 'KILL', opponentJerseyNumber: null });
    const result = generateOpponentScoutingReport(events);
    assert.equal(result.insufficientData, false);
    if (result.insufficientData) throw new Error();
    assert.equal(result.dominantErrorType, null);
    assert.equal(result.dominantErrorCount, 0);
  });

  // ── Jersey tallying ───────────────────────────────────────────────────────────
  it('produces per-jersey tallies when jersey numbers are present', () => {
    const events: InputEvent[] = [
      ...Array(4).fill({ courtZone: 4, eventType: 'KILL', opponentJerseyNumber: 7 }),
      ...Array(2).fill({ courtZone: 1, eventType: 'ACE', opponentJerseyNumber: 7 }),
      ...Array(3).fill({ courtZone: 3, eventType: 'ATTACK_ERROR', opponentJerseyNumber: 14 }),
      ...Array(3).fill({ courtZone: 2, eventType: 'KILL', opponentJerseyNumber: 14 }),
    ];
    const result = generateOpponentScoutingReport(events);
    assert.equal(result.insufficientData, false);
    if (result.insufficientData) throw new Error();
    assert.ok(result.jerseyTallies !== null);
    const j7 = result.jerseyTallies!.find((t) => t.jerseyNumber === 7)!;
    assert.equal(j7.kills, 4);
    assert.equal(j7.aces, 2);
    assert.equal(j7.errors, 0);
    const j14 = result.jerseyTallies!.find((t) => t.jerseyNumber === 14)!;
    assert.equal(j14.kills, 3);
    assert.equal(j14.errors, 3);
  });

  it('jerseyTallies is null when no jersey numbers were captured', () => {
    const events: InputEvent[] = Array(12).fill({ courtZone: 1, eventType: 'KILL', opponentJerseyNumber: null });
    const result = generateOpponentScoutingReport(events);
    assert.equal(result.insufficientData, false);
    if (result.insufficientData) throw new Error();
    assert.equal(result.jerseyTallies, null);
  });
});
