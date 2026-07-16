import clsx from 'clsx';
import type { MatchStatus, SetScore } from '../../types';

// Best-of-5 — mirrors SETS_TO_WIN_MATCH in backend/src/lib/setOperations.ts.
const SETS_TO_WIN = 3;

export type ScoreSide = 'home' | 'away';

/**
 * The live scoreboard: big tap-to-score digits, gold on our side, navy on
 * theirs, with the set number and set history.
 *
 * Display data comes in as plain values rather than a Match, so this can back a
 * read-only match view later without dragging the tracker's data fetching with
 * it. Every handler is optional and independent — omit them all to render a
 * read-only board, or pass only the ones a given surface should offer.
 */
export interface LiveScoreboardProps {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeSetsWon: number;
  awaySetsWon: number;
  setScores: SetScore[];
  status: MatchStatus;
  /** The set the tracker is pointed at — not necessarily the set being played. */
  currentSet: number;

  /** Jump straight to a set (1–5) to view or correct it. */
  onSelectSet?: (set: number) => void;
  /** Adjust a side's running score by `delta`. */
  onScore?: (side: ScoreSide, delta: number) => void;
  /** Award the current set to whoever leads, ignoring the points threshold. */
  onEndSet?: () => void;
  /** Take back the most recently completed set. */
  onUndoSet?: () => void;
  /** Zero the current set's running score only. */
  onResetSet?: () => void;
  /** Zero the entire match — sets won and history included. */
  onResetMatch?: () => void;
  /** Start/finish the match (IN_PROGRESS ↔ COMPLETED). */
  onToggleStatus?: () => void;
  /** Undo the last recorded stat event — distinct from undoing a set. */
  onUndoEvent?: () => void;
  canUndoEvent?: boolean;
  /** Disables the mutating controls while a request is in flight. */
  busy?: boolean;
}

/** Three dots per side, filled up to the sets that side has won. */
function SetsWonDots({ won, side }: { won: number; side: ScoreSide }) {
  return (
    <div className="flex gap-1.5" aria-label={`${won} of ${SETS_TO_WIN} sets won`}>
      {Array.from({ length: SETS_TO_WIN }, (_, i) => (
        <span
          key={i}
          className={clsx(
            'w-2.5 h-2.5 rounded-full shrink-0',
            i < won ? (side === 'home' ? 'bg-gold-500' : 'bg-navy-500') : 'bg-grey-200',
          )}
        />
      ))}
    </div>
  );
}

interface TeamPanelProps {
  name: string;
  score: number;
  setsWon: number;
  side: ScoreSide;
  onScore?: (side: ScoreSide, delta: number) => void;
  busy?: boolean;
}

function TeamPanel({ name, score, setsWon, side, onScore, busy }: TeamPanelProps) {
  const isHome = side === 'home';
  const interactive = !!onScore;

  function addPoint() {
    if (!busy) onScore?.(side, 1);
  }

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Add a point to ${name}` : undefined}
      onClick={interactive ? addPoint : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                addPoint();
              }
            }
          : undefined
      }
      className={clsx(
        'flex flex-col p-5 sm:p-6 transition-colors outline-none',
        isHome
          ? 'border-l-4 border-gold-500 bg-gradient-to-b from-gold-500/10 to-transparent'
          : 'border-r-4 border-navy-500 items-end text-right',
        interactive && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500',
        interactive && (isHome ? 'hover:bg-gold-500/15' : 'hover:bg-navy-500/5'),
      )}
    >
      <div className={clsx('flex items-center gap-2.5 min-h-[26px]', !isHome && 'flex-row-reverse')}>
        <span className="font-display font-bold text-lg sm:text-2xl uppercase tracking-wide leading-none text-navy-700 truncate">
          {name}
        </span>
        <span className="text-[10px] font-bold tracking-widest text-grey-600 border border-grey-200 rounded px-1.5 py-0.5 shrink-0">
          {isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      <div className="mt-3">
        <SetsWonDots won={setsWon} side={side} />
      </div>

      {/* Zero-padded so the digits hold their width and the two sides stay
          visually level as scores cross from one digit to two. */}
      <div className="font-display tabular-nums font-extrabold leading-[0.92] tracking-tight text-grey-900 mt-auto pt-4 text-[clamp(56px,11vw,120px)]">
        {String(score).padStart(2, '0')}
      </div>

      {onScore && (
        <div className={clsx('flex items-center gap-3 mt-2', !isHome && 'flex-row-reverse')}>
          <button
            type="button"
            aria-label={`Subtract a point from ${name}`}
            disabled={busy || score === 0}
            onClick={(e) => {
              e.stopPropagation();
              onScore(side, -1);
            }}
            // The panel itself is a keyboard target, so keep this button's own
            // Enter/Space from bubbling up and also adding a point.
            onKeyDown={(e) => e.stopPropagation()}
            className="grid place-items-center w-11 h-11 shrink-0 rounded-lg bg-grey-50 hover:bg-grey-200 disabled:opacity-40 text-grey-900 text-2xl font-semibold border border-grey-200 transition-colors leading-none"
          >
            −
          </button>
          <span className="text-[11px] text-grey-400 font-medium">Tap score to add · − to correct</span>
        </div>
      )}
    </div>
  );
}

export default function LiveScoreboard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  homeSetsWon,
  awaySetsWon,
  setScores,
  status,
  currentSet,
  onSelectSet,
  onScore,
  onEndSet,
  onUndoSet,
  onResetSet,
  onResetMatch,
  onToggleStatus,
  onUndoEvent,
  canUndoEvent = false,
  busy = false,
}: LiveScoreboardProps) {
  const tied = homeScore === awayScore;
  const hasSets = setScores.length > 0;

  return (
    <div className="card p-2.5 space-y-2">
      {/* ── Set jump + match-level controls ──
          Direct 1–5 jump (rather than prev/next stepping) so a mis-tap in an
          earlier set can be fixed without walking back through the others. */}
      {(onSelectSet || onToggleStatus || onUndoEvent) && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-1.5 pt-1.5">
          {onSelectSet && (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelectSet(s)}
                  aria-pressed={currentSet === s}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-sm tabular-nums font-bold transition-colors border',
                    currentSet === s
                      ? 'bg-gold-500 border-gold-500 text-navy-900'
                      : 'bg-grey-50 border-grey-200 text-grey-600 hover:bg-grey-200',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {onToggleStatus && (
              <button
                type="button"
                onClick={onToggleStatus}
                className={clsx(
                  'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                  status === 'IN_PROGRESS'
                    ? 'bg-gold-500/15 text-navy-900 border border-gold-500/50'
                    : 'bg-grey-50 text-grey-600 border border-grey-200',
                )}
              >
                {status === 'IN_PROGRESS' ? '● LIVE' : status}
              </button>
            )}

            {onUndoEvent && (
              <button
                type="button"
                onClick={onUndoEvent}
                disabled={busy || !canUndoEvent}
                // "Event" vs. the "Undo Set" button below: this takes back the
                // last recorded stat (kill, dig…), not a whole set.
                title="Undo the last recorded stat event"
                className="bg-grey-50 hover:bg-grey-200 disabled:opacity-40 text-grey-900 text-xs font-medium px-3 py-1.5 rounded-lg border border-grey-200 transition-colors"
              >
                ↩ Undo Event
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Scorebug ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch rounded-2xl overflow-hidden">
        <TeamPanel
          name={homeName}
          score={homeScore}
          setsWon={homeSetsWon}
          side="home"
          onScore={onScore}
          busy={busy}
        />

        <div className="flex flex-col items-center justify-center gap-1 px-4 sm:px-5 py-6 bg-grey-50 border-x border-grey-200 min-w-[92px]">
          <div className="text-[11px] font-bold tracking-[0.24em] text-navy-700">SET</div>
          <div className="font-display tabular-nums font-extrabold leading-none text-grey-900 text-[clamp(32px,5vw,56px)]">
            {currentSet}
          </div>
          <div className="font-display tabular-nums font-bold text-xl text-grey-600 mt-2 flex items-center gap-2">
            <span className="text-navy-700">{homeSetsWon}</span>
            <span className="text-grey-400 text-base">–</span>
            <span className="text-grey-600">{awaySetsWon}</span>
          </div>
          <div className="text-[10px] font-semibold tracking-widest text-grey-400">SETS WON</div>
        </div>

        <TeamPanel
          name={awayName}
          score={awayScore}
          setsWon={awaySetsWon}
          side="away"
          onScore={onScore}
          busy={busy}
        />
      </div>

      {/* ── Set operations ── */}
      {(onUndoSet || onEndSet || onResetSet || onResetMatch) && (
        <div className="flex items-center justify-center gap-2 flex-wrap px-2 pb-1.5 pt-1">
          {onUndoSet && (
            <button
              type="button"
              onClick={onUndoSet}
              disabled={busy || !hasSets}
              title="Take back the most recently completed set"
              className="text-sm font-medium text-grey-600 hover:text-navy-700 bg-grey-50 border border-grey-200 hover:border-grey-400 disabled:opacity-40 disabled:hover:text-grey-600 disabled:hover:border-grey-200 rounded-xl px-4 py-2.5 transition-colors"
            >
              ↩ Undo Set
            </button>
          )}

          {onEndSet && (
            <button
              type="button"
              onClick={onEndSet}
              disabled={busy || tied}
              // A tied set has no winner to award it to; the backend rejects it
              // too, but disabling here explains why rather than erroring.
              title={tied ? 'Scores are tied — no winner to award the set to' : 'Award this set to whoever leads'}
              className="font-display font-bold text-[15px] tracking-wide text-navy-900 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:hover:bg-gold-500 rounded-xl px-6 py-2.5 transition-colors"
            >
              END SET →
            </button>
          )}

          {onResetSet && (
            <button
              type="button"
              onClick={onResetSet}
              disabled={busy}
              title="Zero this set's score only"
              className="text-sm font-medium text-grey-600 hover:text-navy-700 bg-grey-50 border border-grey-200 hover:border-grey-400 disabled:opacity-40 rounded-xl px-4 py-2.5 transition-colors"
            >
              Reset Set
            </button>
          )}

          {onResetMatch && (
            <button
              type="button"
              onClick={onResetMatch}
              disabled={busy}
              title="Zero the whole match — every set and its history"
              className="text-sm font-semibold text-error-strong bg-error/10 hover:bg-error/20 border border-error/30 disabled:opacity-40 rounded-xl px-4 py-2.5 transition-colors"
            >
              Reset Match
            </button>
          )}
        </div>
      )}

      {/* ── Set results ── */}
      <div className="border-t border-grey-200 px-3 pt-3 pb-1.5">
        <div className="text-[11px] text-grey-600 font-semibold uppercase tracking-wider mb-2">
          Set Results
        </div>
        {hasSets ? (
          <div className="flex gap-2.5 flex-wrap">
            {[...setScores]
              .sort((a, b) => a.set - b.set)
              .map((s) => {
                const homeWon = s.home > s.away;
                return (
                  <div key={s.set} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-grey-600 font-semibold">Set {s.set}</span>
                    <span
                      className={clsx(
                        'tabular-nums text-[15px] font-bold px-3.5 py-1.5 rounded-lg border',
                        homeWon
                          ? 'bg-navy-100 border-navy-100 text-navy-700'
                          : 'bg-grey-50 border-grey-200 text-grey-600',
                      )}
                    >
                      {s.home}–{s.away}
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-sm text-grey-400">
            No completed sets yet — press{' '}
            <span className="text-navy-700 font-semibold">END SET</span> to record one.
          </div>
        )}
      </div>
    </div>
  );
}
