import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { teamsApi, membershipsApi, playerPortalApi } from '../lib/api';

export type ViewMode = 'coach' | 'player';

const STORAGE_KEY = 'vv_view_mode';

const COACH_TEAM_ROLES = ['HEAD_COACH', 'ASSISTANT_COACH', 'STATISTICIAN'];

interface ViewModeContextValue {
  /** Active portal the UI should render. */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** User owns or staffs at least one team. */
  canCoach: boolean;
  /** User has a PLAYER membership or a linked player record. */
  canPlay: boolean;
  /** User can act as both — only then do we show a toggle. */
  isDual: boolean;
  /** Capability queries still resolving. */
  isLoading: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readStored(): ViewMode | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'coach' || v === 'player' ? v : null;
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const enabled = !!user;

  // Reuse the same query keys/functions as the app hooks so the cache is shared.
  const ownedTeams = useQuery({ queryKey: ['teams', 'my-teams'], queryFn: teamsApi.myTeams, enabled });
  const memberships = useQuery({ queryKey: ['memberships', 'me'], queryFn: membershipsApi.myTeams, enabled });
  const playerDash = useQuery({ queryKey: ['player', 'dashboard'], queryFn: playerPortalApi.dashboard, enabled });

  const canCoach = useMemo(() => {
    if (!user) return false;
    const owns = (ownedTeams.data?.length ?? 0) > 0;
    const staffs = (memberships.data ?? []).some((m) => COACH_TEAM_ROLES.includes(m.role));
    return owns || staffs;
  }, [user, ownedTeams.data, memberships.data]);

  const canPlay = useMemo(() => {
    if (!user) return false;
    const playsOnTeam = (memberships.data ?? []).some((m) => m.role === 'PLAYER');
    const hasLinkedRecord = (playerDash.data?.players?.length ?? 0) > 0;
    return playsOnTeam || hasLinkedRecord;
  }, [user, memberships.data, playerDash.data]);

  const isDual = canCoach && canPlay;
  const isLoading = enabled && (ownedTeams.isLoading || memberships.isLoading || playerDash.isLoading);

  const [stored, setStored] = useState<ViewMode | null>(() => readStored());

  // Resolve the effective view mode: a single-capability user is locked to that
  // capability; a dual user respects their stored choice (default: coach).
  const viewMode: ViewMode = useMemo(() => {
    if (canCoach && !canPlay) return 'coach';
    if (canPlay && !canCoach) return 'player';
    if (isDual) return stored ?? 'coach';
    // No capabilities yet (still loading or brand-new user) — fall back to stored/coach.
    return stored ?? 'coach';
  }, [canCoach, canPlay, isDual, stored]);

  const setViewMode = (mode: ViewMode) => {
    setStored(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  // Keep storage consistent if a dual user's stored value is stale.
  useEffect(() => {
    if (isDual && !stored) {
      localStorage.setItem(STORAGE_KEY, 'coach');
    }
  }, [isDual, stored]);

  const value: ViewModeContextValue = {
    viewMode,
    setViewMode,
    canCoach,
    canPlay,
    isDual,
    isLoading,
  };

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used inside <ViewModeProvider>');
  return ctx;
}
