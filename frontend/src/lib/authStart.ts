/**
 * Whether the app may render signed-in pages before /auth/me answers (9.5.3).
 * Only the cached account the stored token belongs to may stand in: the
 * server still checks every request, and a 401 from /auth/me signs out.
 * Tested copy: backend/src/lib/authStart.ts (logic below the marker must stay
 * identical; backend/src/lib/authStart.test.ts checks it).
 */
export type AuthStart = 'render' | 'wait' | 'sign-in';

export function initialAuthState(
  token: string | null,
  cachedUserId: string | null,
  tokenUserId: (t: string) => string | null,
): AuthStart {
  if (!token) return 'sign-in';
  const owner = tokenUserId(token);
  return owner !== null && cachedUserId === owner ? 'render' : 'wait';
}
