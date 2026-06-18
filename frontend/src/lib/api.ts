import axios from 'axios';
import type { Team, Player, Match, Event, MatchAnalytics, TeamAnalytics, PlayerAnalytics, HeatmapData, ZoneCounts, MomentumData, RotationData, AdvancedMetrics } from '../types';
export interface TeamTrend {
  matchId: string;
  opponent: string;
  matchDate: string;
  kills: number;
  aces: number;
  blocks: number;
  digs: number;
  hittingPercentage: number | null;
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Teams ────────────────────────────────────────────────────────────────────
export const teamsApi = {
  list: () => api.get<Team[]>('/teams').then((r) => r.data),
  get: (id: string) => api.get<Team>(`/teams/${id}`).then((r) => r.data),
  create: (data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Team>('/teams', data).then((r) => r.data),
  update: (id: string, data: Partial<Team>) =>
    api.patch<Team>(`/teams/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/teams/${id}`),
};

// ─── Players ──────────────────────────────────────────────────────────────────
export const playersApi = {
  listByTeam: (teamId: string) =>
    api.get<Player[]>(`/players/by-team/${teamId}`).then((r) => r.data),
  get: (id: string) => api.get<Player>(`/players/${id}`).then((r) => r.data),
  create: (data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Player>('/players', data).then((r) => r.data),
  update: (id: string, data: Partial<Player>) =>
    api.patch<Player>(`/players/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/players/${id}`),
};

// ─── Matches ──────────────────────────────────────────────────────────────────
export const matchesApi = {
  listByTeam: (teamId: string) =>
    api.get<Match[]>(`/matches/by-team/${teamId}`).then((r) => r.data),
  get: (id: string) => api.get<Match>(`/matches/${id}`).then((r) => r.data),
  create: (data: Omit<Match, 'id' | 'createdAt' | 'updatedAt' | 'status'>) =>
    api.post<Match>('/matches', data).then((r) => r.data),
  update: (id: string, data: Partial<Match>) =>
    api.patch<Match>(`/matches/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/matches/${id}`),
  updateScore: (id: string, data: Partial<Pick<Match, 'homeScore' | 'awayScore' | 'homeSetsWon' | 'awaySetsWon'>>) =>
    api.patch<Match>(`/matches/${id}/score`, data).then((r) => r.data),
  resetSetScore: (id: string) =>
    api.post<Match>(`/matches/${id}/score/reset`).then((r) => r.data),
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventsApi = {
  listByMatch: (matchId: string, setNumber?: number) =>
    api
      .get<Event[]>(`/events/by-match/${matchId}`, {
        params: setNumber ? { setNumber } : {},
      })
      .then((r) => r.data),
  record: (data: {
    matchId: string;
    playerId: string;
    eventType: string;
    setNumber: number;
    rallyNumber?: number;
    courtZone?: number | null;
    rotationNumber?: number | null;
    notes?: string;
  }) => api.post<Event>('/events', data).then((r) => r.data),
  undoLast: (matchId: string) =>
    api.delete<{ deleted: string }>(`/events/undo/${matchId}`).then((r) => r.data),
  delete: (id: string) => api.delete(`/events/${id}`),
};

export const analyticsApi = {
  match: (matchId: string) =>
    api.get<MatchAnalytics>(`/analytics/matches/${matchId}`).then((r) => r.data),

  team: (teamId: string) =>
    api.get<TeamAnalytics>(`/analytics/teams/${teamId}`).then((r) => r.data),

  player: (playerId: string) =>
  api
    .get<PlayerAnalytics>(`/analytics/players/${playerId}`)
    .then((r) => r.data),
    
  trends: (teamId: string) =>
    api.get<TeamTrend[]>(`/analytics/teams/${teamId}/trends`).then((r) => r.data),

  matchZones: (matchId: string, category?: string) =>
    api.get<ZoneCounts>(`/analytics/matches/${matchId}/zones`, {
      params: category ? { category } : {},
    }).then((r) => r.data),

  matchHeatmap: (matchId: string) =>
    api.get<HeatmapData>(`/analytics/matches/${matchId}/heatmap`).then((r) => r.data),

  teamHeatmap: (teamId: string) =>
    api.get<HeatmapData>(`/analytics/teams/${teamId}/heatmap`).then((r) => r.data),

  playerHeatmap: (playerId: string) =>
    api.get<HeatmapData>(`/analytics/players/${playerId}/heatmap`).then((r) => r.data),

  matchMomentum: (matchId: string) =>
    api.get<MomentumData>(`/analytics/matches/${matchId}/momentum`).then((r) => r.data),

  matchRotations: (matchId: string) =>
    api.get<RotationData>(`/analytics/matches/${matchId}/rotations`).then((r) => r.data),

  teamRotations: (teamId: string) =>
    api.get<RotationData>(`/analytics/teams/${teamId}/rotations`).then((r) => r.data),

  matchAdvanced: (matchId: string) =>
    api.get<AdvancedMetrics>(`/analytics/matches/${matchId}/advanced`).then((r) => r.data),

  teamAdvanced: (teamId: string) =>
    api.get<AdvancedMetrics>(`/analytics/teams/${teamId}/advanced`).then((r) => r.data),
};

export default api;
