import { randomUUID, randomInt } from 'crypto';

// Human-enterable join code: 8 chars, unambiguous alphabet (no 0/O/1/I).
// Shared by per-email invitation codes and the reusable team join codes so
// every code a user sees looks and behaves identically.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a unique join code. `exists` answers "is this code already taken?"
 * for whatever namespace the caller draws from (invitations, team player
 * codes, team staff codes).
 */
export async function generateUniqueCode(exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!(await exists(code))) return code;
  }
  // Extremely unlikely; fall back to a UUID-derived code.
  return randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}
