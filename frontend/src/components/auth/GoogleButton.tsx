import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { authApi } from '../../lib/api';
import { renderGoogleButton, type GoogleButtonText } from '../../lib/googleIdentity';
import { googleSignInAvailable, isNative } from '../../lib/native';
import { nativeGoogleIdToken } from '../../lib/googleNative';

// A nonce lives 5 minutes on the server; a page left open gets a fresh one first.
const NONCE_REFRESH_MS = 4 * 60 * 1000;

interface GoogleButtonProps {
  /** What the Google sign-in confirms. `link` and `delete` need a signed-in user. */
  purpose: 'signin' | 'link' | 'delete';
  text?: GoogleButtonText;
  /** Gets Google's ID token and the nonce it answers. The server decides the rest. */
  onToken: (token: { idToken: string; nonce: string }) => void | Promise<void>;
}

/**
 * Google's own sign-in button, wired to a one-time nonce from our server.
 * The website draws Google's own button; the Android app draws ours and opens
 * Android's account sheet. The iPhone app renders nothing (see
 * googleSignInAvailable).
 */
export default function GoogleButton(props: GoogleButtonProps) {
  if (!googleSignInAvailable()) return null;
  return isNative() ? <NativeGoogleButton {...props} /> : <WebGoogleButton {...props} />;
}

const NATIVE_LABEL: Record<GoogleButtonText, string> = {
  signin_with: 'Sign in with Google',
  signup_with: 'Sign up with Google',
  continue_with: 'Continue with Google',
};

function NativeGoogleButton({ purpose, text = 'continue_with', onToken }: GoogleButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setBusy(true);
    setFailed(false);
    try {
      // A nonce works once, so each tap asks for its own.
      const { nonce } = await authApi.nonce(purpose);
      const idToken = await nativeGoogleIdToken(nonce);
      if (idToken) await onToken({ idToken, nonce });
    } catch (err) {
      // A signing key Google doesn't know fails here every time, for everyone
      // on that build: it has to reach us, not only the user.
      Sentry.captureException(err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className="flex w-full items-center justify-center gap-3 min-h-[44px] rounded-full border border-grey-300 bg-white px-4 text-sm font-medium text-grey-900 disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? 'Opening Google…' : NATIVE_LABEL[text]}
      </button>
      {failed && (
        <p className="text-center text-grey-600 text-sm mt-2" role="status">
          Google sign-in isn't available right now. Try again.
        </p>
      )}
    </div>
  );
}

/** Google's "G", as its branding rules ask for on a custom button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.96 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function WebGoogleButton({ purpose, text = 'continue_with', onToken }: GoogleButtonProps) {
  const holder = useRef<HTMLDivElement>(null);
  const handler = useRef(onToken);
  handler.current = onToken;
  const [failed, setFailed] = useState(false);
  // Bumped after each use (a nonce works once) and on a timer.
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!holder.current) return;
    let cancelled = false;
    // Google inserts its button a moment after renderButton returns, so two
    // quick effect runs (a re-render, React's dev double-run) would both land
    // in the same element. Each run gets its own slot; a stale one is detached.
    const slot = document.createElement('div');
    const width = holder.current.clientWidth;
    holder.current.replaceChildren(slot);
    const started = Date.now();
    const timer = window.setTimeout(() => setRound((r) => r + 1), NONCE_REFRESH_MS);
    // Timers do not tick while a laptop sleeps: coming back to the page after
    // the nonce has gone stale gets a fresh one before the next click.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - started > NONCE_REFRESH_MS) setRound((r) => r + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    (async () => {
      try {
        const { nonce } = await authApi.nonce(purpose);
        if (cancelled) return;
        await renderGoogleButton(slot, {
          nonce,
          width,
          text,
          onCredential: (idToken) => {
            void Promise.resolve(handler.current({ idToken, nonce })).finally(() => {
              if (!cancelled) setRound((r) => r + 1);
            });
          },
        });
        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      slot.remove();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [purpose, text, round]);

  return (
    <div>
      <div ref={holder} className="flex justify-center min-h-[44px]" />
      {failed && (
        <p className="text-center text-grey-600 text-sm mt-2" role="status">
          Google sign-in isn't available right now.{' '}
          <button type="button" className="inline-flex items-center min-h-[44px] text-navy-700 font-medium underline" onClick={() => setRound((r) => r + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
