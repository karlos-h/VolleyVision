import type { TeamRole, AccessTier, AccessCategory } from '../types';

// Single source of truth for how team roles and access tiers render, so
// "add Manager everywhere" and future role tweaks happen in one place.

export const ROLE_LABELS: Record<TeamRole, string> = {
  HEAD_COACH:      'Head Coach',
  MANAGER:         'Manager',
  ASSISTANT_COACH: 'Assistant Coach',
  STATISTICIAN:    'Statistician',
  PLAYER:          'Player',
  VIEWER:          'Viewer',
};

// Order shown in role pickers (most to least authority).
export const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  'HEAD_COACH', 'MANAGER', 'ASSISTANT_COACH', 'STATISTICIAN', 'PLAYER', 'VIEWER',
].map((value) => ({ value: value as TeamRole, label: ROLE_LABELS[value as TeamRole] }));

// Categorical badge classes (defined in index.css). No positive/negative meaning.
export const ROLE_BADGE: Record<TeamRole, string> = {
  HEAD_COACH:      'badge-accent',
  MANAGER:         'badge-brand',
  ASSISTANT_COACH: 'badge-info',
  STATISTICIAN:    'badge-neutral',
  PLAYER:          'badge-success',
  VIEWER:          'badge-neutral',
};

// ─── Access tiers (Iteration 3) ───────────────────────────────────────────────

export const TIER_LABELS: Record<AccessTier, string> = {
  VIEW_ONLY:         'View only',
  APPROVAL_REQUIRED: 'Approval',
  FULL_ACCESS:       'Full access',
};

export const TIER_OPTIONS: { value: AccessTier; label: string }[] = [
  'VIEW_ONLY', 'APPROVAL_REQUIRED', 'FULL_ACCESS',
].map((value) => ({ value: value as AccessTier, label: TIER_LABELS[value as AccessTier] }));

export const ACCESS_CATEGORIES: { key: AccessCategory; label: string; hint: string }[] = [
  { key: 'rosterAccess',     label: 'Roster',      hint: 'Add, edit, and remove players' },
  { key: 'invitationAccess', label: 'Invitations', hint: 'Send team invitations' },
  { key: 'matchAccess',      label: 'Matches',     hint: 'Create, edit, and delete matches' },
];
