import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useMatch, useEvents, useRecordEvent, useUndoEvent, useUpdateMatch } from '../hooks';
import type { EventType, Player } from '../types';
import { EVENT_META, POSITION_LABELS } from '../types';
import clsx from 'clsx';
import CourtZoneSelector from '../components/tracking/CourtZoneSelector';

// Event buttons grouped by category for the tablet layout
const CATEGORIES = [
  {
    label: 'Attack',
    events: ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT'] as EventType[],
  },
  {
    label: 'Serve',
    events: ['ACE', 'SERVICE_ERROR', 'SERVE_IN'] as EventType[],
  },
  {
    label: 'Pass',
    events: ['PASS_3', 'PASS_2', 'PASS_1', 'PASS_0'] as EventType[],
  },
  {
    label: 'Block',
    events: ['SOLO_BLOCK', 'BLOCK_ASSIST', 'BLOCK_ERROR'] as EventType[],
  },
  {
    label: 'Defence',
    events: ['DIG', 'DIG_ERROR'] as EventType[],
  },
  {
    label: 'Set',
    events: ['ASSIST', 'SETTING_ERROR'] as EventType[],
  },
];

function getMeta(type: EventType) {
  return EVENT_META.find((m) => m.type === type)!;
}

// Flash feedback state
type FlashState = { text: string; ok: boolean } | null;

export default function TrackingPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { data: match, isLoading } = useMatch(matchId!);
  const { data: events } = useEvents(matchId!);
  const recordEvent = useRecordEvent(matchId!);
  const undoEvent = useUndoEvent(matchId!);
  const updateMatch = useUpdateMatch();

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [flash, setFlash] = useState<FlashState>(null);
  const [justRecorded, setJustRecorded] = useState<string | null>(null);

  // Auto-select first player when roster loads
  useEffect(() => {
    if (match?.team?.players?.length && !selectedPlayer) {
      setSelectedPlayer(match.team.players[0]);
    }
  }, [match?.team?.players, selectedPlayer]);

  const showFlash = useCallback((text: string, ok: boolean) => {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 1400);
  }, []);

  async function handleRecord(eventType: EventType) {
    if (!selectedPlayer) {
      showFlash('Select a player first', false);
      return;
    }

    try {
      setJustRecorded(eventType);
      const meta = getMeta(eventType);
      await recordEvent.mutateAsync({
        matchId: matchId!,
        playerId: selectedPlayer.id,
        eventType,
        setNumber: currentSet,
        courtZone: selectedZone,
      });
      showFlash(`${meta.label} → #${selectedPlayer.jerseyNumber}`, true);
      setTimeout(() => setJustRecorded(null), 300);
    } catch {
      showFlash('Failed to record', false);
      setJustRecorded(null);
    }
  }

  async function handleUndo() {
    try {
      await undoEvent.mutateAsync();
      showFlash('Undone', true);
    } catch {
      showFlash('Nothing to undo', false);
    }
  }

  async function handleStatusToggle() {
    if (!match) return;
    const next = match.status === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS';
    await updateMatch.mutateAsync({ id: matchId!, data: { status: next } });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-court-950 flex items-center justify-center">
        <p className="text-chalk-400">Loading match…</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-court-950 flex items-center justify-center">
        <p className="text-chalk-400">Match not found. <Link to="/teams" className="text-spike-400">Go back</Link></p>
      </div>
    );
  }

  const recentEvents = [...(events ?? [])].reverse().slice(0, 6);
  const players = match.team?.players ?? [];

  return (
    <div className="min-h-screen bg-court-950 flex flex-col select-none">
      {/* ── Top bar ── */}
      <header className="bg-court-900 border-b border-court-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/teams/${match.teamId}/matches`} className="text-chalk-400 hover:text-chalk-200 shrink-0">
              ← Back
            </Link>
            <div className="min-w-0">
              <div className="font-bold text-chalk-100 leading-tight truncate">
                {match.team?.name} <span className="text-chalk-400 font-normal">vs</span> {match.opponent}
              </div>
              <div className="text-xs text-chalk-400">
                {match.competition && `${match.competition} · `}
                {format(new Date(match.matchDate), 'PPP')}
                {match.venue && ` · ${match.venue}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Set selector */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setCurrentSet(s)}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-sm font-mono font-bold transition-colors',
                    currentSet === s
                      ? 'bg-spike-500 text-court-950'
                      : 'bg-court-800 text-chalk-400 hover:bg-court-700'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Match status */}
            <button
              onClick={handleStatusToggle}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                match.status === 'IN_PROGRESS'
                  ? 'bg-spike-500/20 text-spike-400 border border-spike-500/30'
                  : 'bg-court-800 text-chalk-400 border border-court-700'
              )}
            >
              {match.status === 'IN_PROGRESS' ? '● LIVE' : match.status}
            </button>

            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={undoEvent.isPending || !events?.length}
              className="bg-court-800 hover:bg-court-700 disabled:opacity-40 text-chalk-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-court-700 transition-colors"
            >
              ↩ Undo
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-3 py-4 flex flex-col gap-4 pb-6">
        {/* Flash feedback overlay */}
        {flash && (
          <div
            className={clsx(
              'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all',
              flash.ok ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
            )}
          >
            {flash.text}
          </div>
        )}

        {/* ── Player roster ── */}
        <div className="card p-3">
          <div className="text-xs text-chalk-400 font-medium mb-2 px-1">
            Select Player — Set {currentSet}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-xl py-2 px-1 transition-all border',
                  selectedPlayer?.id === player.id
                    ? 'bg-spike-500 border-spike-400 text-court-950'
                    : 'bg-court-800 border-court-700 text-chalk-300 hover:border-chalk-500'
                )}
              >
                <span className="font-mono font-bold text-base leading-tight">
                  {player.jerseyNumber}
                </span>
                <span className="text-xs font-medium leading-tight mt-0.5 truncate w-full text-center">
                  {player.lastName}
                </span>
                <span
                  className={clsx(
                    'text-[10px] font-semibold mt-0.5',
                    selectedPlayer?.id === player.id ? 'text-court-950/70' : 'text-chalk-500'
                  )}
                >
                  {POSITION_LABELS[player.position]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Selected player banner ── */}
        <div
          className={clsx(
            'rounded-2xl px-5 py-3 flex items-center justify-between transition-colors',
            selectedPlayer ? 'bg-court-800 border border-court-600' : 'bg-court-900 border border-court-800'
          )}
        >
          {selectedPlayer ? (
            <>
              <div>
                <span className="text-spike-400 font-mono font-bold text-lg">
                  #{selectedPlayer.jerseyNumber}
                </span>
                <span className="text-chalk-100 font-semibold ml-2">
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </span>
                <span className="text-chalk-400 text-sm ml-2">
                  {POSITION_LABELS[selectedPlayer.position]}
                </span>
              </div>
              <div className="text-xs text-chalk-400">
                Tap an event button to record
              </div>
            </>
          ) : (
            <span className="text-chalk-400 text-sm">← Select a player above</span>
          )}
        </div>

        {/* ── Event buttons ── */}
        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <div className="text-xs font-semibold text-chalk-500 uppercase tracking-widest mb-2 px-1">
                {cat.label}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cat.events.length}, 1fr)` }}>
                {cat.events.map((eventType) => {
                  const meta = getMeta(eventType);
                  const cls =
                    meta.outcome === 'positive'
                      ? 'btn-event-positive'
                      : meta.outcome === 'negative'
                      ? 'btn-event-negative'
                      : 'btn-event-neutral';
                  return (
                    <button
                      key={eventType}
                      className={clsx(cls, justRecorded === eventType && 'scale-95 brightness-150')}
                      onClick={() => handleRecord(eventType)}
                      disabled={recordEvent.isPending}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Court zone selector ── */}
        <div className="card p-3">
          <CourtZoneSelector value={selectedZone} onChange={setSelectedZone} />
        </div>

        {/* ── Recent events feed ── */}
        {recentEvents.length > 0 && (
          <div className="card overflow-hidden mt-2">
            <div className="px-4 py-2 border-b border-court-800 text-xs text-chalk-400 font-medium">
              Recent Events
            </div>
            <div className="divide-y divide-court-800">
              {recentEvents.map((event) => {
                const meta = getMeta(event.eventType);
                return (
                  <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={clsx(
                        'w-2 h-2 rounded-full shrink-0',
                        meta.outcome === 'positive'
                          ? 'bg-emerald-400'
                          : meta.outcome === 'negative'
                          ? 'bg-red-400'
                          : 'bg-chalk-500'
                      )}
                    />
                    <span className="font-mono text-xs text-chalk-400 shrink-0">
                      S{event.setNumber}
                    </span>
                    <span className="text-sm font-medium text-chalk-200 flex-1">
                      {meta.label}
                    </span>
                    {event.player && (
                      <span className="text-xs text-chalk-400 font-mono">
                        #{event.player.jerseyNumber} {event.player.lastName}
                      </span>
                    )}
                    {event.courtZone != null && (
                      <span className="badge bg-court-800 text-spike-400 border border-court-700">
                        Z{event.courtZone}
                      </span>
                    )}
                    <span className="text-xs text-chalk-600">
                      {format(new Date(event.recordedAt), 'HH:mm:ss')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
