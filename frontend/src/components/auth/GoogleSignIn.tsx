import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi, getApiErrorMessage } from '../../lib/api';
import { isNative } from '../../lib/native';
import type { GoogleButtonText } from '../../lib/googleIdentity';
import GoogleButton from './GoogleButton';

interface GoogleSignInProps {
  text?: GoogleButtonText;
  /** Where a returning user goes once signed in. */
  signedInPath?: string;
  /** Where a brand-new user goes after the sign-up form, instead of onboarding (an invitation page). */
  afterSignupPath?: string;
  onError: (message: string) => void;
}

/**
 * "or continue with Google" under a sign-in or sign-up form (9.6.S4). A known
 * Google account is signed in; a new one goes to the short sign-up form for
 * the Terms and 13+ tick. Renders nothing in the apps (see GoogleButton).
 */
export default function GoogleSignIn({ text, signedInPath = '/dashboard', afterSignupPath, onError }: GoogleSignInProps) {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  if (isNative()) return null;

  async function handleToken(token: { idToken: string; nonce: string }) {
    onError('');
    try {
      const result = await authApi.google(token);
      if ('needsSignup' in result) {
        navigate('/signup/google', { state: { signupToken: result.signupToken, suggested: result.suggested, afterSignupPath } });
        return;
      }
      adoptSession(result);
      navigate(signedInPath, { replace: true });
    } catch (err) {
      onError(getApiErrorMessage(err, "Couldn't sign you in with Google. Try again."));
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4" aria-hidden="true">
        <span className="h-px flex-1 bg-grey-200" />
        <span className="text-grey-600 text-xs uppercase tracking-wide">or</span>
        <span className="h-px flex-1 bg-grey-200" />
      </div>
      <GoogleButton purpose="signin" text={text} onToken={handleToken} />
    </div>
  );
}
