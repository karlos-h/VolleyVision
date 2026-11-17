// Sign in with Google inside the Android app, through Android's Credential
// Manager (the @capgo/capacitor-social-login plugin). Like the website, the
// app only ever receives an ID token: the server decides who that is.
//
// The token's audience is the WEB client id, not an Android one. The Android
// OAuth client in Google Cloud only registers the package name and signing
// key (SHA-1) that are allowed to ask; its id is never used in code.
import { GOOGLE_WEB_CLIENT_ID } from './googleIdentity';
import { nativePlatform } from './native';

let ready: Promise<void> | null = null;

async function plugin() {
  // Dynamic import: the web bundle never loads the plugin (see lib/native.ts).
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  ready ??= SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      mode: 'online',
      // We need the ID token only. Without this the plugin makes a second
      // Google call for an access token the app never uses.
      skipAuthOnlyAuthorizationAfterSignIn: true,
    },
  }).catch((err) => {
    ready = null; // a later tap may succeed
    throw err;
  });
  await ready;
  return SocialLogin;
}

/**
 * Shows Android's Google account sheet and returns the ID token, or null when
 * the user closed the sheet. `nonce` is the one-time code from our server;
 * Google copies it into the token. Throws when Google sign-in failed.
 */
export async function nativeGoogleIdToken(nonce: string): Promise<string | null> {
  const SocialLogin = await plugin();
  try {
    const { result } = await SocialLogin.login({ provider: 'google', options: { nonce } });
    const idToken = 'idToken' in result ? result.idToken : null;
    if (!idToken) throw new Error('Google returned no ID token.');
    return idToken;
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    if (code === 'USER_CANCELLED' || /cancel/i.test(err instanceof Error ? err.message : String(err))) return null;
    throw err;
  }
}

/**
 * Sign-out and account deletion: the plugin keeps the last Google ID token
 * (name, email, picture) in the app's private storage until told to forget
 * it. The token is useless to our server by then (its nonce is spent), but
 * nothing of a signed-out account should stay on the device. Best effort.
 */
export function forgetNativeGoogle(): void {
  if (nativePlatform() !== 'android') return;
  plugin()
    .then((SocialLogin) => SocialLogin.logout({ provider: 'google' }))
    .catch(() => { /* never signed in with Google here, or Google is unavailable */ });
}
