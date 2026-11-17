import { useState, FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { authApi, getApiErrorMessage } from '../lib/api';
import type { SignupIntent } from '../types';
import { INTENT_OPTIONS, onboardingPath } from '../lib/signupIntent';
import TermsConsent from '../components/legal/TermsConsent';
import LegalLinks from '../components/legal/LegalLinks';

type SignupState = {
  signupToken: string;
  suggested: { firstName: string; lastName: string; email: string };
  /** Set when sign-up began on an invitation page: go back there, skip the intent choice. */
  afterSignupPath?: string;
};

function readState(value: unknown): SignupState | null {
  const s = value as Partial<SignupState> | null;
  return s && typeof s.signupToken === 'string' && s.suggested && typeof s.suggested.email === 'string' ? (s as SignupState) : null;
}

/**
 * The one step between a first Sign in with Google and an account (9.6.S4):
 * confirm the name, pick coach or player, tick the 13+ and Terms box. Nothing
 * exists on the server until this form is sent. The sign-up token lives only
 * in router state (this tab's history, valid 10 minutes): a pasted link or a
 * new tab has none and starts again from /login.
 */
export default function SocialSignupPage() {
  const state = readState(useLocation().state);
  const { adoptSession } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(state?.suggested.firstName ?? '');
  const [lastName, setLastName] = useState(state?.suggested.lastName ?? '');
  const [intent, setIntent] = useState<SignupIntent | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state) return <Navigate to="/login" replace />;
  const { signupToken, suggested, afterSignupPath } = state;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await authApi.socialComplete({ signupToken, acceptTerms: agreed, firstName, lastName, signupIntent: intent });
      adoptSession(session);
      navigate(afterSignupPath ?? onboardingPath(intent), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't create your account. Try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-grey-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/vv-icon.svg" alt="" className="w-9 h-9" />
          <span className="font-display font-bold text-xl text-navy-700 tracking-tight">VolleyVision</span>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-grey-900 mb-1">Almost there</h1>
          <p className="text-grey-600 text-sm mb-6">
            You're signing up with Google as <span className="text-grey-600 font-medium break-all">{suggested.email}</span>.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-error/30 border border-error text-error text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="social-first-name" className="block text-grey-600 text-sm font-medium mb-1.5">First name</label>
                <input
                  id="social-first-name"
                  type="text"
                  autoComplete="given-name"
                  className="input"
                  maxLength={100}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="social-last-name" className="block text-grey-600 text-sm font-medium mb-1.5">Last name</label>
                <input
                  id="social-last-name"
                  type="text"
                  autoComplete="family-name"
                  className="input"
                  maxLength={100}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            {!afterSignupPath && (
              <div>
                <p className="block text-grey-600 text-sm font-medium mb-2">I'm signing up to…</p>
                <p className="text-grey-600 text-xs mb-2">This just tailors your welcome. You can create or join teams either way.</p>
                <div className="space-y-2">
                  {INTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={intent === opt.value}
                      onClick={() => setIntent(intent === opt.value ? null : opt.value)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                        intent === opt.value
                          ? 'bg-gold-500/15 border-gold-500/50 text-grey-900'
                          : 'bg-grey-50 border-grey-200 text-grey-600 hover:border-navy-100',
                      )}
                    >
                      <span
                        className={clsx(
                          'w-4 h-4 rounded-full border-2 shrink-0 transition-colors',
                          intent === opt.value ? 'border-gold-500 bg-gold-500' : 'border-navy-100',
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-tight">{opt.label}</span>
                        <span className="block text-xs text-grey-600 mt-0.5">{opt.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <TermsConsent checked={agreed} onChange={setAgreed} />

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-grey-600 text-sm mt-4">
          Changed your mind?{' '}
          <Link to="/login" className="text-navy-700 hover:text-navy-700 font-medium">Back to sign in</Link>
        </p>
        <LegalLinks className="mt-6" />
      </div>
    </div>
  );
}
