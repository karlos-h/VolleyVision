// The "coach or player" choice at sign-up, shared by the password form and the
// Sign in with Google form (9.6.S4). A one-time onboarding nudge only: it is
// never part of permission or auth logic.
import type { SignupIntent } from '../types';

export interface IntentOption {
  value: SignupIntent;
  label: string;
  description: string;
}

export const INTENT_OPTIONS: IntentOption[] = [
  { value: 'COACH', label: 'Coach a team', description: "I'll be running a team" },
  { value: 'PLAYER', label: 'Play for a team', description: "I'll be joining a team" },
  { value: 'UNSURE', label: 'Not sure yet', description: "I'll figure it out later" },
];

/** Where a brand-new account lands. Call only immediately after registration. */
export function onboardingPath(intent: SignupIntent | null): string {
  if (intent === 'COACH') return '/onboarding/coach';
  if (intent === 'PLAYER') return '/onboarding/player';
  return '/teams'; // UNSURE or null: the existing default
}
