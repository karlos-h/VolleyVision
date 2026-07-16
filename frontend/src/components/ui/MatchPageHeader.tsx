import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import MatchSubNav from './MatchSubNav';
import { ArrowLeftIcon, ChevronIcon } from './icons';
import { isPendingApproval, type MatchStatus } from '../../types';
import { useHasPermission, useUpdateMatch } from '../../hooks';

// Shared header for all three match sub-pages (Match Stats | Events | Track).
// Consolidates the back button, title/meta block, and MatchSubNav so every
// sub-page renders an identical shell instead of hand-rolling its own.

const STATUS_STYLES: Record<MatchStatus, string> = {
  SCHEDULED: 'badge-info',
  IN_PROGRESS: 'badge-accent',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-error',
};

const MATCH_STATUSES: MatchStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

interface MatchPageHeaderProps {
  matchId: string;
  teamId: string;
  teamName?: string;
  opponent: string;
  matchDate: string;
  competition?: string | null;
  venue?: string | null;
  status: MatchStatus;
  // Live tracking is offered only to those who can track a live match; the Track
  // tab additionally requires the match to be IN_PROGRESS (same gating as before).
  canTrack: boolean;
}

export default function MatchPageHeader({
  matchId,
  teamId,
  teamName,
  opponent,
  matchDate,
  competition,
  venue,
  status,
  canTrack,
}: MatchPageHeaderProps) {
  const canManageMatches = useHasPermission(teamId, 'CREATE_MATCH');
  const updateMatch = useUpdateMatch();
  const [pendingNotice, setPendingNotice] = useState('');

  async function handleStatusChange(next: MatchStatus) {
    const result = await updateMatch.mutateAsync({ id: matchId, data: { status: next } });
    if (isPendingApproval(result)) {
      // Applied optimistically by the <select>'s own value binding — since we
      // read `status` from props (server state), a no-op mutation naturally
      // leaves the select showing the prior value once queries settle.
      setPendingNotice(`Status change submitted for the head coach's approval.`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          to={`/teams/${teamId}/matches`}
          className="btn-secondary inline-flex items-center gap-1.5 text-sm py-1.5 px-3"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Matches
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-grey-900">
              {teamName ? `${teamName} vs ${opponent}` : `vs ${opponent}`}
            </h1>
            <p className="text-sm text-grey-600 mt-1">
              {format(new Date(matchDate), 'PPP')}
              {venue && ` · ${venue}`}
              {competition && ` · ${competition}`}
            </p>
          </div>
          {canManageMatches ? (
            <div className="relative shrink-0">
              <select
                value={status}
                disabled={updateMatch.isPending}
                onChange={(e) => handleStatusChange(e.target.value as MatchStatus)}
                aria-label="Match status"
                className={`badge ${STATUS_STYLES[status]} appearance-none pr-6 pl-2 cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500`}
              >
                {MATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <ChevronIcon className="w-3 h-3 rotate-90 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <span className={`badge ${STATUS_STYLES[status]} shrink-0`}>{status.replace('_', ' ')}</span>
          )}
        </div>
        {pendingNotice && (
          <div className="mt-3 card p-3 border border-gold-500/40 bg-gold-500/10 text-sm text-grey-900 flex items-center justify-between gap-3">
            <span>{pendingNotice}</span>
            <button className="text-grey-500 hover:text-grey-900 text-xs" onClick={() => setPendingNotice('')}>Dismiss</button>
          </div>
        )}
      </div>

      <MatchSubNav matchId={matchId} trackable={canTrack && status === 'IN_PROGRESS'} />
    </div>
  );
}
