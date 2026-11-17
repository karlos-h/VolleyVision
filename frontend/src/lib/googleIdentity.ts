// Sign in with Google on the web (9.6.S4), through Google Identity Services.
// The script is loaded only when a page actually shows the button, and the
// browser only ever receives an ID token: the server decides who that is.
//
// The client id is public by design (it is in every page that shows the
// button) and is the same for staging and production; the server checks tokens
// against the same value (GOOGLE_WEB_CLIENT_ID in backend/fly.*.toml).
export const GOOGLE_WEB_CLIENT_ID = '975527779291-8d5e17etol10mfe16shq82u7uuu1naru.apps.googleusercontent.com';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
  cancel: () => void;
};

const googleId = (): GoogleId | undefined =>
  (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;

let loading: Promise<GoogleId> | null = null;

/** Loads Google's script once. Rejects if it is blocked or offline. */
export function loadGoogleIdentity(): Promise<GoogleId> {
  const ready = googleId();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => {
      const id = googleId();
      if (id) resolve(id);
      else reject(new Error('Google sign-in did not load.'));
    };
    script.onerror = () => {
      loading = null; // a later attempt (back online) may succeed
      script.remove();
      reject(new Error('Google sign-in did not load.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type GoogleButtonText = 'signin_with' | 'signup_with' | 'continue_with';

/**
 * Draws Google's own button into `parent`. `nonce` is the one-time code from
 * our server: Google copies it into the token, which is how the server knows
 * the token was made for this attempt. One button per page (Google keeps a
 * single configuration).
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  options: { nonce: string; text: GoogleButtonText; width: number; onCredential: (idToken: string) => void },
): Promise<void> {
  const id = await loadGoogleIdentity();
  id.initialize({
    client_id: GOOGLE_WEB_CLIENT_ID,
    nonce: options.nonce,
    auto_select: false, // One Tap stays off: signing in is always a deliberate tap
    callback: (response) => {
      if (response.credential) options.onCredential(response.credential);
    },
  });
  id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: options.text,
    logo_alignment: 'center',
    width: Math.min(Math.max(options.width, 200), 400),
  });
}
