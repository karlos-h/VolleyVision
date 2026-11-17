import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileApi, getApiErrorMessage } from '../../lib/api';
import { googleSignInAvailable } from '../../lib/native';
import GoogleButton from './GoogleButton';

/**
 * Profile → how this account signs in (9.6.S5): password, Google, or both.
 * Connecting or removing Google asks for the account password first, because
 * a way of signing in outlives a password reset: a borrowed, still-signed-in
 * device must not be able to add one. An account with no password can't remove
 * Google (it would be locked out) until it sets one with Forgot password.
 */
export default function SignInMethods() {
  const { user, refreshUser } = useAuth();
  const [mode, setMode] = useState<'idle' | 'connect' | 'remove'>('idle');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // A server older than v9.20.0 (or a user cached before it) has no such fields.
  if (!user || user.signInMethods === undefined) return null;
  const hasPassword = user.hasPassword === true;
  const hasGoogle = user.signInMethods.includes('google');

  function reset(message = '') {
    setMode('idle');
    setPassword('');
    setError('');
    setNotice(message);
  }

  async function connect(token: { idToken: string; nonce: string }) {
    setError('');
    try {
      await profileApi.linkGoogle({ ...token, ...(hasPassword ? { password } : {}) });
      await refreshUser();
      reset('Google is connected. You can sign in with either.');
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't connect Google. Try again."));
    }
  }

  async function remove(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await profileApi.unlinkGoogle(password);
      await refreshUser();
      reset('Google is removed. You sign in with your password.');
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't remove Google. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const passwordField = (
    <div>
      <label htmlFor="signin-methods-password" className="block text-sm font-medium text-grey-700 mb-1">Your password</label>
      <input
        id="signin-methods-password"
        type="password"
        autoComplete="current-password"
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-grey-200">
      <h3 className="text-sm font-medium text-grey-900 mb-2">Signing in</h3>
      <ul className="text-sm text-grey-700 space-y-1">
        <li>
          Password: {hasPassword ? 'set' : (
            <>not set. <Link to="/forgot-password" className="text-navy-700 font-medium underline">Set one</Link> with a reset link.</>
          )}
        </li>
        <li>Google: {hasGoogle ? 'connected' : 'not connected'}</li>
      </ul>

      {notice && <p className="text-sm text-success-strong mt-2" role="status">{notice}</p>}
      {error && <p className="text-sm text-error-strong mt-2" role="alert">{error}</p>}

      {mode === 'idle' && !hasGoogle && (
        !googleSignInAvailable()
          ? <p className="text-sm text-grey-600 mt-2">To connect Google, open VolleyVision in a web browser.</p>
          : <button type="button" onClick={() => { setNotice(''); setMode('connect'); }} className="inline-flex items-center min-h-[44px] text-sm text-navy-700 font-medium">Connect Google</button>
      )}
      {mode === 'idle' && hasGoogle && hasPassword && (
        <button type="button" onClick={() => { setNotice(''); setMode('remove'); }} className="inline-flex items-center min-h-[44px] text-sm text-navy-700 font-medium">Remove Google</button>
      )}
      {mode === 'idle' && hasGoogle && !hasPassword && (
        <p className="text-sm text-grey-600 mt-2">
          Google is the only way into this account. Set a password before removing it, and to sign in on the iPhone app, which doesn't have Google sign-in yet.
        </p>
      )}

      {mode === 'connect' && (
        <div className="mt-3 space-y-3 max-w-sm">
          {hasPassword && passwordField}
          {(!hasPassword || password.length > 0)
            ? <GoogleButton purpose="link" text="continue_with" onToken={connect} />
            : <p className="text-sm text-grey-600">Enter your password, then choose your Google account.</p>}
          <button type="button" onClick={() => reset()} className="inline-flex items-center min-h-[44px] text-sm text-grey-700 font-medium">Cancel</button>
        </div>
      )}

      {mode === 'remove' && (
        <form onSubmit={remove} className="mt-3 space-y-3 max-w-sm">
          {passwordField}
          <div className="flex flex-wrap gap-x-5">
            <button type="submit" className="btn-primary min-h-[44px]" disabled={busy || !password}>{busy ? 'Removing…' : 'Remove Google'}</button>
            <button type="button" onClick={() => reset()} className="inline-flex items-center min-h-[44px] text-sm text-grey-700 font-medium">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
