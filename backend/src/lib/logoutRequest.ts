/**
 * Sign-out order (9.6.0.2): the stored token is read before it is cleared and
 * handed to the request explicitly. axios runs its request interceptor on a
 * later tick, after clearToken, so a request left to pick the token up itself
 * went out with none and the server never learned of the sign-out.
 * The frontend keeps a byte-identical copy below the marker
 * (frontend/src/lib/logoutRequest.ts); logoutRequest.test.ts checks it.
 */
export function endSession(
  getToken: () => string | null,
  clearToken: () => void,
  send: (authorization: string) => Promise<unknown>,
): void {
  const token = getToken();
  // Fire and forget: offline or already revoked, the device signs out anyway.
  if (token) send(`Bearer ${token}`).catch(() => {});
  clearToken();
}
