import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRedeemInvitation } from '../hooks';

/**
 * Public entry point for the invitation email flow (Stabilization Pass 2).
 * Works for brand-new / logged-out users: they authenticate here (sign in or
 * create an account), then the join code is redeemed against the backend, which
 * creates the TeamMembership exactly like the in-app accept flow.
 */
export default function RedeemInvitationPage() {
  const [params] = useSearchParams();
  const { user, login, register } = useAuth();
  const redeem = useRedeemInvitation();
  const navigate = useNavigate();

  const [code, setCode] = useState(params.get('code') ?? '');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinedTeam, setJoinedTeam] = useState<string | null>(null);

  async function doRedeem(): Promise<boolean> {
    if (!code.trim()) { setError('Enter the join code from your invitation email.'); return false; }
    try {
      const inv = await redeem.mutateAsync(code.trim());
      setJoinedTeam(inv.team?.name ?? 'your team');
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't redeem that code. Check it and try again.");
      return false;
    }
  }

  // Already logged in — just redeem.
  async function handleRedeemOnly(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    await doRedeem();
    setBusy(false);
  }

  // Logged out — authenticate first, then redeem in the same step.
  async function handleAuthAndRedeem(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (authMode === 'login') {
        await login(email, password);
      } else {
        if (password.length < 8) { setError('Password must be at least 8 characters.'); setBusy(false); return; }
        await register({ email, password, firstName, lastName });
      }
      await doRedeem();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? (authMode === 'login'
        ? "Couldn't sign you in. Check your email and password, then try again."
        : "Couldn't create your account. Check your details and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 bg-gold-500 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-navy-900">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-1 3v3H6l4 4 4-4h-3V7H9z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-chalk-100 tracking-tight">VolleyVision</span>
        </div>

        {joinedTeam ? (
          <div className="card p-6 text-center space-y-4">
            <h1 className="text-lg font-semibold text-chalk-100">You're in</h1>
            <p className="text-chalk-400 text-sm">You've joined <strong className="text-chalk-100">{joinedTeam}</strong>.</p>
            <button className="btn-primary w-full" onClick={() => navigate('/my-teams')}>Go to my teams</button>
          </div>
        ) : (
          <div className="card p-6">
            <h1 className="text-lg font-semibold text-chalk-100 mb-1">Join a team</h1>
            <p className="text-chalk-500 text-sm mb-5">Enter your join code to accept the invitation.</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-error/30 border border-error text-error-dark text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-chalk-400 text-sm font-medium mb-1.5">Join code</label>
              <input
                className="input tracking-widest font-mono"
                placeholder="e.g. A1B2C3D4"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            {user ? (
              <form onSubmit={handleRedeemOnly}>
                <button type="submit" className="btn-primary w-full" disabled={busy}>
                  {busy ? 'Joining…' : 'Join team'}
                </button>
              </form>
            ) : (
              <>
                <div className="flex gap-1 mb-4 p-1 rounded-xl bg-navy-700">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 text-sm py-1.5 rounded-lg transition-colors ${authMode === 'login' ? 'bg-navy-500 text-chalk-100' : 'text-chalk-400'}`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 text-sm py-1.5 rounded-lg transition-colors ${authMode === 'register' ? 'bg-navy-500 text-chalk-100' : 'text-chalk-400'}`}
                  >
                    Create account
                  </button>
                </div>

                <form onSubmit={handleAuthAndRedeem} className="space-y-3">
                  {authMode === 'register' && (
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                      <input className="input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  )}
                  <input className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <input className="input" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <p className="text-chalk-600 text-xs">Use the email address your invitation was sent to.</p>
                  <button type="submit" className="btn-primary w-full" disabled={busy}>
                    {busy ? 'Joining…' : authMode === 'login' ? 'Sign in & join' : 'Create account & join'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        <p className="text-center text-chalk-500 text-sm mt-4">
          <Link to="/login" className="text-gold-500 hover:text-gold-600 font-medium">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
