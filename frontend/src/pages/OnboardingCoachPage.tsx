import { Link } from 'react-router-dom';

export default function OnboardingCoachPage() {
  return (
    <div className="min-h-screen bg-court-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-14 h-14 bg-spike-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-spike-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">Welcome, Coach!</h1>
          <p className="text-chalk-400 text-sm mt-2 leading-relaxed">
            Your account is ready. Create your first team to start tracking matches, managing your roster, and unlocking analytics.
          </p>
        </div>
        <div className="card p-5 text-left space-y-3">
          <p className="text-xs font-semibold text-chalk-500 uppercase tracking-wider">Get started</p>
          <ol className="space-y-2 text-sm text-chalk-300 list-decimal list-inside">
            <li>Create a team</li>
            <li>Add players to your roster</li>
            <li>Schedule or record a match</li>
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/teams/new" className="btn-primary w-full text-center">
            Create my first team
          </Link>
          <Link to="/my-teams" className="btn-secondary w-full text-center text-sm">
            Go to My Teams
          </Link>
        </div>
      </div>
    </div>
  );
}
