// Single abstraction point for auth-token persistence.
//
// The web app uses localStorage; the future React Native client will swap
// this module's internals for SecureStore without touching any callers.
// Nothing outside this file may read or write the token key directly.

const TOKEN_KEY = 'vv_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
