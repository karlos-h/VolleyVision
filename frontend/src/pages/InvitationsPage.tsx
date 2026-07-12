import { useMyInvitations, useAcceptInvitation, useDeclineInvitation } from '../hooks';
import type { Invitation, TeamRole } from '../types';

const ROLE_LABELS: Record<TeamRole, string> = {
  HEAD_COACH:      'Head Coach',
  ASSISTANT_COACH: 'Assistant Coach',
  STATISTICIAN:    'Statistician',
  PLAYER:          'Player',
  VIEWER:          'Viewer',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  HEAD_COACH:      'bg-spike-600/20 text-spike-400',
  ASSISTANT_COACH: 'bg-info/30 text-info',
  STATISTICIAN:    'bg-purple-800/30 text-purple-300',
  PLAYER:          'bg-success/30 text-success-dark',
  VIEWER:          'bg-court-700 text-chalk-400',
};

function daysLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function InvitationCard({ inv }: { inv: Invitation }) {
  const accept  = useAcceptInvitation();
  const decline = useDeclineInvitation();

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-chalk-100 text-base">{inv.team?.name}</p>
          <p className="text-chalk-500 text-xs mt-0.5">{inv.team?.division} · Season {inv.team?.season}</p>
          <p className="text-chalk-400 text-sm mt-2">
            Invited by{' '}
            <span className="text-chalk-200 font-medium">
              {inv.invitedBy?.firstName} {inv.invitedBy?.lastName}
            </span>
          </p>
        </div>
        <span className={`badge text-xs shrink-0 mt-0.5 ${ROLE_COLORS[inv.role]}`}>
          {ROLE_LABELS[inv.role]}
        </span>
      </div>

      <p className="text-chalk-500 text-xs">
        Expires in {daysLeft(inv.expiresAt)} day{daysLeft(inv.expiresAt) !== 1 ? 's' : ''}
      </p>

      {accept.isError && (
        <p className="text-error-dark text-xs">
          {(accept.error as any)?.response?.data?.error ?? "Couldn't accept that invitation. Try again."}
        </p>
      )}
      {decline.isError && (
        <p className="text-error-dark text-xs">
          {(decline.error as any)?.response?.data?.error ?? "Couldn't decline that invitation. Try again."}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="btn-secondary flex-1 text-sm py-2"
          disabled={accept.isPending}
          onClick={() => accept.mutate(inv.token)}
        >
          {accept.isPending ? 'Accepting…' : 'Accept'}
        </button>
        <button
          className="btn-secondary flex-1 text-sm py-2"
          disabled={decline.isPending}
          onClick={() => decline.mutate(inv.token)}
        >
          {decline.isPending ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </div>
  );
}

export default function InvitationsPage() {
  const { data: invitations, isLoading } = useMyInvitations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-chalk-100">Invitations</h1>
        <p className="text-chalk-400 text-sm mt-0.5">Pending team invitations sent to your email</p>
      </div>

      {isLoading ? (
        <p className="text-chalk-400 text-sm">Loading invitations…</p>
      ) : !invitations?.length ? (
        <div className="card p-12 text-center">
          <p className="text-chalk-300 font-medium">No pending invitations</p>
          <p className="text-chalk-500 text-sm mt-1">When a coach invites you to a team it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {invitations.map((inv) => (
            <InvitationCard key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </div>
  );
}
