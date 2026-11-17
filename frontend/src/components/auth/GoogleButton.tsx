import { useEffect, useRef, useState } from 'react';
import { authApi } from '../../lib/api';
import { renderGoogleButton, type GoogleButtonText } from '../../lib/googleIdentity';
import { isNative } from '../../lib/native';

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
 * Web only for now: the Android app needs the native plugin (not built yet),
 * and the iPhone app may not show Google until Sign in with Apple ships with it
 * (App Store guideline 4.8). In the apps this renders nothing.
 */
export default function GoogleButton({ purpose, text = 'continue_with', onToken }: GoogleButtonProps) {
  const holder = useRef<HTMLDivElement>(null);
  const handler = useRef(onToken);
  handler.current = onToken;
  const [failed, setFailed] = useState(false);
  // Bumped after each use (a nonce works once) and on a timer.
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (isNative() || !holder.current) return;
    let cancelled = false;
    // Google inserts its button a moment after renderButton returns, so two
    // quick effect runs (a re-render, React's dev double-run) would both land
    // in the same element. Each run gets its own slot; a stale one is detached.
    const slot = document.createElement('div');
    const width = holder.current.clientWidth;
    holder.current.replaceChildren(slot);
    const timer = window.setTimeout(() => setRound((r) => r + 1), NONCE_REFRESH_MS);
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
    };
  }, [purpose, text, round]);

  if (isNative()) return null;
  return (
    <div>
      <div ref={holder} className="flex justify-center min-h-[44px]" />
      {failed && (
        <p className="text-center text-chalk-500 text-sm mt-2" role="status">
          Google sign-in isn't available right now.{' '}
          <button type="button" className="text-navy-700 font-medium underline" onClick={() => setRound((r) => r + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
