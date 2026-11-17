// Sign in with Google inside the Android app, through Android's Credential
// Manager (the @capgo/capacitor-social-login plugin). Like the website, the
// app only ever receives an ID token: the server decides who that is.
//
// The token's audience is the WEB client id, not an Android one. The Android
// OAuth client in Google Cloud only registers the package name and signing
// key (SHA-1) that are allowed to ask; its id is never used in code.
import { GOOGLE_WEB_CLIENT_ID } from './googleIdentity';

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
    if (/cancel/i.test(err instanceof Error ? err.message : String(err))) return null;
    throw err;
  }
}
