import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import MatchSubNav from './MatchSubNav';
import { ArrowLeftIcon } from './icons';
import type { MatchStatus } from '../../types';

// Shared header for all three match sub-pages (Match Stats | Events | Track).
// Consolidates the back button, title/meta block, and MatchSubNav so every
// sub-page renders an identical shell instead of hand-rolling its own.

const STATUS_STYLES: Record<MatchStatus, string> = {
  SCHEDULED: 'badge-info',
  IN_PROGRESS: 'badge-accent',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-error',
};

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
          <span className={`badge ${STATUS_STYLES[status]} shrink-0`}>{status.replace('_', ' ')}</span>
        </div>
      </div>

      <MatchSubNav matchId={matchId} trackable={canTrack && status === 'IN_PROGRESS'} />
    </div>
  );
}
