import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useMatch, useEvents, useHasPermission } from '../hooks';
import { EVENT_META, type Event } from '../types';
import MatchPageHeader from '../components/ui/MatchPageHeader';
import { ChevronIcon } from '../components/ui/icons';

// Light-mode, read-only changelog of a match's recorded events (Task 6).
// Available for a match in any status — unlike Track, which is live-only.

const META = new Map(EVENT_META.map((m) => [m.type, m]));

const OUTCOME_DOT: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'bg-success',
  negative: 'bg-error',
  neutral: 'bg-grey-400',
};

function actorLabel(e: Event): string {
  if (e.player) return `#${e.player.jerseyNumber} ${e.player.firstName} ${e.player.lastName}`;
  if (e.isOpponentEvent) return e.opponentJerseyNumber != null ? `Opponent #${e.opponentJerseyNumber}` : 'Opponent';
  return '—';
}

export default function MatchEventsPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { data: match, isLoading: matchLoading } = useMatch(matchId!);
  const { data: events, isLoading: eventsLoading } = useEvents(matchId!);
  const canTrack = useHasPermission(match?.teamId ?? '', 'TRACK_MATCH');
  const [openSets, setOpenSets] = useState<Record<number, boolean>>({});

  if (matchLoading) return <p className="text-grey-600">Loading…</p>;
  if (!match) return <p className="text-error">Match not found.</p>;

  // Group events by set for readable section headers, preserving chronological order.
  const bySet = new Map<number, Event[]>();
  for (const e of events ?? []) {
    if (!bySet.has(e.setNumber)) bySet.set(e.setNumber, []);
    bySet.get(e.setNumber)!.push(e);
  }
  const setNumbers = [...bySet.keys()].sort((a, b) => a - b);
  // Only the most recent set starts expanded — the one just played or in
  // progress — so the changelog doesn't open as a wall of history.
  const isOpen = (setNo: number) => openSets[setNo] ?? (setNo === setNumbers[setNumbers.length - 1]);
  const toggleSet = (setNo: number) => setOpenSets((prev) => ({ ...prev, [setNo]: !isOpen(setNo) }));

  return (
    <div className="space-y-6">
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

      {/* Changelog */}
      {eventsLoading ? (
        <p className="text-grey-600 text-sm">Loading events…</p>
      ) : (events ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-grey-600">No events recorded for this match yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {setNumbers.map((setNo) => {
            const open = isOpen(setNo);
            return (
              <div key={setNo} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSet(setNo)}
                  aria-expanded={open}
                  className="w-full px-5 py-2.5 border-b border-grey-200 bg-grey-50 flex items-center justify-between hover:bg-grey-100 transition-colors"
                >
                  <h2 className="font-display font-semibold text-grey-900">Set {setNo}</h2>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-grey-600 tabular-nums">{bySet.get(setNo)!.length} events</span>
                    <ChevronIcon className={`w-4 h-4 text-grey-600 transition-transform ${open ? 'rotate-90' : ''}`} />
                  </span>
                </button>
                {open && (
                  <div className="divide-y divide-grey-200">
                    {bySet.get(setNo)!.map((e) => {
                      const meta = META.get(e.eventType);
                      const outcome = meta?.outcome ?? 'neutral';
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${OUTCOME_DOT[outcome]}`} aria-hidden />
                          <span className="text-[13px] font-semibold text-grey-900 w-24 shrink-0">
                            {meta?.label ?? e.eventType}
                          </span>
                          <span className="text-[13px] text-grey-700 flex-1 min-w-0 truncate">{actorLabel(e)}</span>
                          {e.rallyNumber != null && (
                            <span className="text-[11px] text-grey-400 tabular-nums shrink-0">rally {e.rallyNumber}</span>
                          )}
                          <span className="text-[11px] text-grey-500 tabular-nums shrink-0 w-14 text-right">
                            {format(new Date(e.recordedAt), 'HH:mm')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
