import { Link } from 'react-router-dom';

export default function OnboardingPlayerPage() {
  return (
    <div className="min-h-screen bg-court-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">Welcome to VolleyVision!</h1>
          <p className="text-chalk-400 text-sm mt-2 leading-relaxed">
            Your account is ready. Ask your coach to invite you to your team — you'll get an email invitation once they add you.
          </p>
        </div>
        <div className="card p-5 text-left space-y-3">
          <p className="text-xs font-semibold text-chalk-500 uppercase tracking-wider">What to expect</p>
          <ol className="space-y-2 text-sm text-chalk-300 list-decimal list-inside">
            <li>Your coach invites you by email</li>
            <li>Accept the invitation to join the team</li>
            <li>View your match history and stats</li>
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/invitations" className="btn-primary w-full text-center">
            Check my invitations
          </Link>
          <Link to="/my-teams" className="btn-secondary w-full text-center text-sm">
            Go to My Teams
          </Link>
        </div>
      </div>
    </div>
  );
}
