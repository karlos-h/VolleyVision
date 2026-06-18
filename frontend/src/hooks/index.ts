import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teamsApi, playersApi, matchesApi, eventsApi, analyticsApi } from '../lib/api';
import type { Team, Player, Match } from '../types';

// ─── Teams ────────────────────────────────────────────────────────────────────
export function useTeams() {
  return useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
}

export function useTeam(id: string) {
  return useQuery({ queryKey: ['teams', id], queryFn: () => teamsApi.get(id), enabled: !!id });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => teamsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Team> }) =>
      teamsApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['teams', vars.id] });
    },
  });
}

// ─── Players ──────────────────────────────────────────────────────────────────
export function usePlayers(teamId: string) {
  return useQuery({
    queryKey: ['players', teamId],
    queryFn: () => playersApi.listByTeam(teamId),
    enabled: !!teamId,
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) =>
      playersApi.create(data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['players', vars.teamId] }),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; teamId: string }) => playersApi.delete(vars.id),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['players', vars.teamId] }),
  });
}

export function useUpdatePlayer(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Player> }) =>
      playersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', teamId] });
    },
  });
}

// ─── Matches ──────────────────────────────────────────────────────────────────
export function useMatches(teamId: string) {
  return useQuery({
    queryKey: ['matches', teamId],
    queryFn: () => matchesApi.listByTeam(teamId),
    enabled: !!teamId,
  });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Match, 'id' | 'createdAt' | 'updatedAt' | 'status'>) =>
      matchesApi.create(data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['matches', vars.teamId] }),
  });
}

export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; teamId: string }) => matchesApi.delete(vars.id),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['matches', vars.teamId] }),
  });
}

export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Match> }) =>
      matchesApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['match', vars.id] });
      qc.invalidateQueries({ queryKey: ['analytics', 'match', vars.id] });
    },
  });
}

export function useUpdateScore(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pick<Match, 'homeScore' | 'awayScore' | 'homeSetsWon' | 'awaySetsWon'>>) =>
      matchesApi.updateScore(matchId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match', matchId] }),
  });
}

export function useResetSetScore(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => matchesApi.resetSetScore(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match', matchId] }),
  });
}

// ─── Events ───────────────────────────────────────────────────────────────────
export function useEvents(matchId: string, setNumber?: number) {
  return useQuery({
    queryKey: ['events', matchId, setNumber],
    queryFn: () => eventsApi.listByMatch(matchId, setNumber),
    enabled: !!matchId,
    refetchInterval: 5000, // Live polling every 5s during a match
  });
}

export function useRecordEvent(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eventsApi.record,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', matchId] });
      qc.invalidateQueries({ queryKey: ['analytics', 'match', matchId] });
    },
  });
}

export function useUndoEvent(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => eventsApi.undoLast(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', matchId] });
      qc.invalidateQueries({ queryKey: ['analytics', 'match', matchId] });
    },
  });
}

export function useMatchAnalytics(matchId: string) {
  return useQuery({
    queryKey: ['analytics', 'match', matchId],
    queryFn: () => analyticsApi.match(matchId),
    enabled: !!matchId,
  });
}

export function useTeamAnalytics(teamId: string) {
  return useQuery({
    queryKey: ['analytics', 'team', teamId],
    queryFn: () => analyticsApi.team(teamId),
    enabled: !!teamId,
  });
}

export function usePlayerAnalytics(playerId: string) {
  return useQuery({
    queryKey: ['analytics', 'player', playerId],
    queryFn: () => analyticsApi.player(playerId),
    enabled: !!playerId,
  });
}

export function useTeamTrends(teamId: string) {
  return useQuery({
    queryKey: ['analytics', 'trends', teamId],
    queryFn: () => analyticsApi.trends(teamId),
    enabled: !!teamId,
  });
}

export function useMatchHeatmap(matchId: string) {
  return useQuery({
    queryKey: ['analytics', 'heatmap', 'match', matchId],
    queryFn: () => analyticsApi.matchHeatmap(matchId),
    enabled: !!matchId,
  });
}

export function useTeamHeatmap(teamId: string) {
  return useQuery({
    queryKey: ['analytics', 'heatmap', 'team', teamId],
    queryFn: () => analyticsApi.teamHeatmap(teamId),
    enabled: !!teamId,
  });
}

export function usePlayerHeatmap(playerId: string) {
  return useQuery({
    queryKey: ['analytics', 'heatmap', 'player', playerId],
    queryFn: () => analyticsApi.playerHeatmap(playerId),
    enabled: !!playerId,
  });
}

export function useMatchMomentum(matchId: string) {
  return useQuery({
    queryKey: ['analytics', 'momentum', matchId],
    queryFn: () => analyticsApi.matchMomentum(matchId),
    enabled: !!matchId,
  });
}

export function useMatchReport(matchId: string) {
  return useQuery({
    queryKey: ['analytics', 'report', matchId],
    queryFn: () => analyticsApi.matchReport(matchId),
    enabled: !!matchId,
  });
}

export function useMatchAdvanced(matchId: string) {
  return useQuery({
    queryKey: ['analytics', 'advanced', 'match', matchId],
    queryFn: () => analyticsApi.matchAdvanced(matchId),
    enabled: !!matchId,
  });
}

export function useTeamAdvanced(teamId: string) {
  return useQuery({
    queryKey: ['analytics', 'advanced', 'team', teamId],
    queryFn: () => analyticsApi.teamAdvanced(teamId),
    enabled: !!teamId,
  });
}

export function useMatchRotations(matchId: string) {
  return useQuery({
    queryKey: ['analytics', 'rotations', 'match', matchId],
    queryFn: () => analyticsApi.matchRotations(matchId),
    enabled: !!matchId,
  });
}

export function useTeamRotations(teamId: string) {
  return useQuery({
    queryKey: ['analytics', 'rotations', 'team', teamId],
    queryFn: () => analyticsApi.teamRotations(teamId),
    enabled: !!teamId,
  });
}