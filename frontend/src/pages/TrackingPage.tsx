import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useMatch, useEvents, useRecordEvent, useUndoEvent, useUpdateMatch, useUpdateScore, useResetSetScore, useHasPermission } from '../hooks';
import type { EventType, Player } from '../types';
import { EVENT_META, POSITION_LABELS } from '../types';
import clsx from 'clsx';
import CourtZoneSelector from '../components/tracking/CourtZoneSelector';
import MatchPageHeader from '../components/ui/MatchPageHeader';

// Event buttons grouped by category for the tablet layout
const CATEGORIES = [
  {
    label: 'Attack',
    events: ['KILL', 'ATTACK_ERROR', 'ATTACK_ATTEMPT', 'TIP', 'FREE_BALL'] as EventType[],
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

  const updateScore = useUpdateScore(matchId!);
  const resetSetScore = useResetSetScore(matchId!);
  // Track is offered only to those who can track a live match (players never
  // can — Iteration 3 Task 6); the shared header uses this to render the Track tab.
  const canTrack = useHasPermission(match?.teamId ?? '', 'TRACK_MATCH');

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [currentSet, setCurrentSet] = useState(1);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [selectedRotation, setSelectedRotation] = useState<number | null>(null);
  const [keepZone, setKeepZone] = useState(true);
  const [flash, setFlash] = useState<FlashState>(null);
  const [justRecorded, setJustRecorded] = useState<string | null>(null);
  const [isOpponentMode, setIsOpponentMode] = useState(false);
  const [opponentJerseyNumber, setOpponentJerseyNumber] = useState('');

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
    if (!isOpponentMode && !selectedPlayer) {
      showFlash('Select a player first', false);
      return;
    }

    try {
      setJustRecorded(eventType);
      const meta = getMeta(eventType);
      const jerseyNum = opponentJerseyNumber.trim() !== '' ? parseInt(opponentJerseyNumber, 10) : null;
      await recordEvent.mutateAsync({
        matchId: matchId!,
        ...(isOpponentMode
          ? { isOpponentEvent: true, opponentJerseyNumber: jerseyNum }
          : { playerId: selectedPlayer!.id }),
        eventType,
        setNumber: currentSet,
        courtZone: selectedZone,
        rotationNumber: selectedRotation,
      });
      if (isOpponentMode) {
        showFlash(`OPP: ${meta.label}${jerseyNum != null ? ` #${jerseyNum}` : ''}`, true);
      } else {
        showFlash(`${meta.label} → #${selectedPlayer!.jerseyNumber}`, true);
      }
      setTimeout(() => setJustRecorded(null), 300);
      if (!keepZone) setSelectedZone(null);
    } catch {
      showFlash("Couldn't save that event", false);
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

  if (isLoading) return <p className="text-grey-600">Loading match…</p>;

  if (!match) {
    return (
      <p className="text-grey-600">Match not found. <Link to="/teams" className="text-navy-700 font-medium">Go back</Link></p>
    );
  }

  // Live tracking is only for in-progress matches (Iteration 3 Task 6). A
  // scheduled/completed/cancelled match can't be live-edited — send the viewer
  // to the read-only Events changelog instead.
  if (match.status !== 'IN_PROGRESS') {
    return <Navigate to={`/matches/${matchId}/events`} replace />;
  }

  const recentEvents = [...(events ?? [])].reverse().slice(0, 6);
  const players = match.team?.players ?? [];

  return (
    <div className="space-y-6 select-none">
      <MatchPageHeader
        matchId={match.id}
        teamId={match.teamId}
        teamName={match.team?.name}
        opponent={match.opponent}
        matchDate={match.matchDate}
        competition={match.competition}
        venue={match.venue}
        status={match.status}
        canTrack={canTrack}
      />

      {/* ── Live Scoreboard + controls ── */}
      <div className="card p-4 space-y-3">
        {/* Control row: set selector + finish-match quick action + undo. The
            match title/date/status now live in the shared MatchPageHeader. */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Set selector */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setCurrentSet(s)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-sm tabular-nums font-bold transition-colors border',
                  currentSet === s
                    ? 'bg-gold-500 border-gold-500 text-navy-900'
                    : 'bg-grey-50 border-grey-200 text-grey-600 hover:bg-grey-200'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Finish match — a natural real-time action while tracking
                (IN_PROGRESS → COMPLETED). Completing redirects to Events. */}
            <button
              onClick={handleStatusToggle}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                match.status === 'IN_PROGRESS'
                  ? 'bg-gold-500/15 text-navy-900 border border-gold-500/50'
                  : 'bg-grey-50 text-grey-600 border border-grey-200'
              )}
            >
              {match.status === 'IN_PROGRESS' ? '● LIVE' : match.status}
            </button>

            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={undoEvent.isPending || !events?.length}
              className="bg-grey-50 hover:bg-grey-200 disabled:opacity-40 text-grey-900 text-xs font-medium px-3 py-1.5 rounded-lg border border-grey-200 transition-colors"
            >
              ↩ Undo
            </button>
          </div>
        </div>

        {/* A completed match redirects to the Events changelog (Task 6), so the
            tracker only ever renders a live, in-progress match here. */}
          <div className="flex items-center justify-between gap-4">
            {/* Home team */}
            <div className="flex-1 text-right">
              <div className="text-sm font-semibold text-grey-900 truncate">{match.team?.name ?? 'Home'}</div>
              <div className="tabular-nums text-4xl font-bold text-grey-900 leading-none mt-1">{match.homeScore ?? 0}</div>
            </div>

            {/* Centre — sets won + controls */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-xl font-bold text-navy-700">{match.homeSetsWon ?? 0}</span>
                <span className="text-grey-600 text-xs font-semibold">Sets</span>
                <span className="tabular-nums text-xl font-bold text-grey-600">{match.awaySetsWon ?? 0}</span>
              </div>
              <div className="text-xs text-grey-600">Set {currentSet}</div>

              {/* Per-set score history */}
              {Array.isArray(match.setScores) && (match.setScores as {set:number;home:number;away:number}[]).length > 0 && (
                <div className="flex gap-1 mt-0.5">
                  {(match.setScores as {set:number;home:number;away:number}[]).map((s) => (
                    <span key={s.set} className="text-[10px] tabular-nums text-grey-600 bg-grey-50 px-1.5 py-0.5 rounded border border-grey-200">
                      {s.home}–{s.away}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => updateScore.mutate({ homeScore: Math.max(0, (match.homeScore ?? 0) - 1) })}
                  className="w-6 h-6 rounded bg-grey-50 hover:bg-grey-200 text-grey-900 text-xs font-bold border border-grey-200"
                  title="Home −1"
                >
                  −
                </button>
                <button
                  onClick={() => updateScore.mutate({ homeScore: (match.homeScore ?? 0) + 1 })}
                  className="w-6 h-6 rounded bg-grey-50 hover:bg-grey-200 text-grey-900 text-xs font-bold border border-grey-200"
                  title="Home +1"
                >
                  +
                </button>
                <button
                  onClick={() => resetSetScore.mutate()}
                  className="px-2 h-6 rounded bg-grey-50 hover:bg-grey-200 text-grey-900 text-[10px] font-medium border border-grey-200"
                  title="Reset set score"
                >
                  RST
                </button>
                <button
                  onClick={() => updateScore.mutate({ awayScore: Math.max(0, (match.awayScore ?? 0) - 1) })}
                  className="w-6 h-6 rounded bg-grey-50 hover:bg-grey-200 text-grey-900 text-xs font-bold border border-grey-200"
                  title="Away −1"
                >
                  −
                </button>
                <button
                  onClick={() => updateScore.mutate({ awayScore: (match.awayScore ?? 0) + 1 })}
                  className="w-6 h-6 rounded bg-grey-50 hover:bg-grey-200 text-grey-900 text-xs font-bold border border-grey-200"
                  title="Away +1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Away team */}
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-grey-900 truncate">{match.opponent}</div>
              <div className="tabular-nums text-4xl font-bold text-grey-600 leading-none mt-1">{match.awayScore ?? 0}</div>
            </div>
          </div>
      </div>

      {/* ── Main ── */}
      <div className="space-y-4">
        {/* Flash feedback overlay */}
        {flash && (
          <div
            className={clsx(
              'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all',
              flash.ok ? 'bg-success text-white' : 'bg-error text-white'
            )}
          >
            {flash.text}
          </div>
        )}

        {/* ── Recording mode toggle ── */}
        <div className="flex items-center gap-3 card p-3">
          <span className="text-xs text-grey-600 font-medium shrink-0">Recording for:</span>
          <div className="flex rounded-lg overflow-hidden border border-grey-200 text-xs font-semibold">
            <button
              onClick={() => setIsOpponentMode(false)}
              className={clsx(
                'px-4 py-2 transition-colors',
                !isOpponentMode ? 'bg-gold-500 text-navy-900' : 'bg-grey-50 text-grey-600 hover:bg-grey-200'
              )}
            >
              Us
            </button>
            <button
              onClick={() => setIsOpponentMode(true)}
              className={clsx(
                'px-4 py-2 transition-colors',
                isOpponentMode ? 'bg-error text-white' : 'bg-grey-50 text-grey-600 hover:bg-grey-200'
              )}
            >
              Opponent
            </button>
          </div>
          {isOpponentMode && (
            <input
              type="number"
              min={1}
              max={99}
              placeholder="Jersey # (opt.)"
              value={opponentJerseyNumber}
              onChange={(e) => setOpponentJerseyNumber(e.target.value)}
              className="input text-sm w-36"
            />
          )}
        </div>

        {/* ── Player roster (hidden in opponent mode) ── */}
        {!isOpponentMode && <div className="card p-3">
          <div className="text-xs text-grey-600 font-medium mb-2 px-1">
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
                    ? 'bg-gold-500 border-gold-500 text-navy-900'
                    : 'bg-grey-50 border-grey-200 text-grey-900 hover:border-navy-500'
                )}
              >
                <span className="tabular-nums font-bold text-base leading-tight">
                  {player.jerseyNumber}
                </span>
                <span className="text-xs font-medium leading-tight mt-0.5 truncate w-full text-center">
                  {player.lastName}
                </span>
                <span
                  className={clsx(
                    'text-[10px] font-semibold mt-0.5',
                    selectedPlayer?.id === player.id ? 'text-navy-900/70' : 'text-grey-600'
                  )}
                >
                  {POSITION_LABELS[player.position]}
                </span>
              </button>
            ))}
          </div>
        </div>}

        {/* ── Selected player banner (own events only) ── */}
        {!isOpponentMode && <div
          className={clsx(
            'rounded-2xl px-5 py-3 flex items-center justify-between transition-colors border',
            selectedPlayer ? 'bg-navy-100 border-navy-500' : 'bg-white border-grey-200'
          )}
        >
          {selectedPlayer ? (
            <>
              <div>
                <span className="text-navy-700 tabular-nums font-bold text-lg">
                  #{selectedPlayer.jerseyNumber}
                </span>
                <span className="text-grey-900 font-semibold ml-2">
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </span>
                <span className="text-grey-600 text-sm ml-2">
                  {POSITION_LABELS[selectedPlayer.position]}
                </span>
              </div>
              <div className="text-xs text-grey-600">
                Tap an event button to record
              </div>
            </>
          ) : (
            <span className="text-grey-600 text-sm">← Select a player above</span>
          )}
        </div>}

        {/* ── Opponent mode banner ── */}
        {isOpponentMode && (
          <div className="rounded-2xl px-5 py-3 flex items-center justify-between bg-error/15 border border-error/30">
            <span className="text-error-strong font-semibold text-sm">Recording opponent actions</span>
            <span className="text-xs text-grey-600">Tap an event to record for opponent</span>
          </div>
        )}

        {/* ── Event buttons ── */}
        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <div className="text-xs font-semibold text-grey-600 mb-2 px-1">
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

        {/* ── Court zone + Rotation selectors ── */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-3">
            <label className="flex items-center gap-2 text-xs text-grey-600 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepZone}
                onChange={(e) => setKeepZone(e.target.checked)}
                className="accent-gold-500 w-4 h-4"
              />
              Keep Selected Zone after recording
            </label>
            <CourtZoneSelector value={selectedZone} onChange={setSelectedZone} />
          </div>

          <div className="card p-3">
            <div className="text-xs text-grey-600 mb-3">Rotation (optional)</div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRotation(selectedRotation === r ? null : r)}
                  className={clsx(
                    'py-3 rounded-xl text-sm font-bold tabular-nums transition-all border',
                    selectedRotation === r
                      ? 'bg-gold-500 border-gold-500 text-navy-900'
                      : 'bg-grey-50 border-grey-200 text-grey-900 hover:border-navy-500'
                  )}
                >
                  R{r}
                </button>
              ))}
            </div>
            {selectedRotation && (
              <p className="text-xs text-navy-700 mt-2 text-center">
                Rotation {selectedRotation} selected — tap again to deselect
              </p>
            )}
          </div>
        </div>

        {/* ── Recent events feed ── */}
        {recentEvents.length > 0 && (
          <div className="card overflow-hidden mt-2">
            <div className="px-4 py-2 border-b border-grey-200 text-xs text-grey-600 font-medium">
              Recent Events
            </div>
            <div className="divide-y divide-grey-200">
              {recentEvents.map((event) => {
                const meta = getMeta(event.eventType);
                return (
                  <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={clsx(
                        'w-2 h-2 rounded-full shrink-0',
                        meta.outcome === 'positive'
                          ? 'bg-success'
                          : meta.outcome === 'negative'
                          ? 'bg-error'
                          : 'bg-grey-400'
                      )}
                    />
                    <span className="tabular-nums text-xs text-grey-600 shrink-0">
                      S{event.setNumber}
                    </span>
                    <span className="text-sm font-medium text-grey-900 flex-1">
                      {meta.label}
                    </span>
                    {event.player && (
                      <span className="text-xs text-grey-600 tabular-nums">
                        #{event.player.jerseyNumber} {event.player.lastName}
                      </span>
                    )}
                    {event.courtZone != null && (
                      <span className="badge bg-grey-50 text-navy-700 border border-grey-200">
                        Z{event.courtZone}
                      </span>
                    )}
                    <span className="text-xs text-grey-600">
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
