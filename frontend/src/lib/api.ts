import axios from 'axios';
import type { Team, Player, Match, Event, MatchAnalytics, TeamAnalytics, PlayerAnalytics, HeatmapData, ZoneCounts, MomentumData, RotationData, AdvancedMetrics, MatchReport, User, AuthResponse, TeamOwner, TeamMember, TeamRole, UserTeamMembership, UserSearchResult, Invitation, UserProfile, PlayerDashboard, CoachDashboard, DetailedHeatmapData, Recommendation, PlayerDevelopmentReport, SeasonIntelligenceReport } from '../types';
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

// Attach stored JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vv_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};

// ─── Teams ────────────────────────────────────────────────────────────────────
export const teamsApi = {
  list: () => api.get<Team[]>('/teams').then((r) => r.data),
  get: (id: string) => api.get<Team>(`/teams/${id}`).then((r) => r.data),
  create: (data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Team>('/teams', data).then((r) => r.data),
  update: (id: string, data: Partial<Team>) =>
    api.patch<Team>(`/teams/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  // Phase 5 Sprint 2 — ownership
  myTeams: () => api.get<Team[]>('/teams/my-teams').then((r) => r.data),
  owner: (id: string) => api.get<TeamOwner | null>(`/teams/${id}/owner`).then((r) => r.data),
  claim: (id: string) => api.post<Team>(`/teams/${id}/claim`).then((r) => r.data),
  transfer: (id: string, newOwnerId: string) =>
    api.post<Team>(`/teams/${id}/transfer`, { newOwnerId }).then((r) => r.data),
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

  matchReport: (matchId: string) =>
    api.get<MatchReport>(`/analytics/matches/${matchId}/report`).then((r) => r.data),

  matchZoneDetail: (matchId: string) =>
    api.get<DetailedHeatmapData>(`/analytics/matches/${matchId}/heatmap/zones`).then((r) => r.data),

  teamZoneDetail: (teamId: string) =>
    api.get<DetailedHeatmapData>(`/analytics/teams/${teamId}/heatmap/zones`).then((r) => r.data),

  playerZoneDetail: (playerId: string) =>
    api.get<DetailedHeatmapData>(`/analytics/players/${playerId}/heatmap/zones`).then((r) => r.data),

  matchReportNarrative: (matchId: string) =>
    api.get<string>(`/analytics/matches/${matchId}/report/narrative`).then((r) => r.data),

  teamRecommendations: (teamId: string) =>
    api.get<Recommendation[]>(`/analytics/teams/${teamId}/recommendations`).then((r) => r.data),

  playerDevelopmentReport: (playerId: string) =>
    api.get<PlayerDevelopmentReport>(`/analytics/players/${playerId}/development`).then((r) => r.data),

  seasonIntelligence: (teamId: string) =>
    api.get<SeasonIntelligenceReport>(`/analytics/teams/${teamId}/season-intelligence`).then((r) => r.data),
};

// ─── Memberships (Phase 5 Sprint 3) ──────────────────────────────────────────
export const membershipsApi = {
  listByTeam: (teamId: string) =>
    api.get<TeamMember[]>(`/teams/${teamId}/members`).then((r) => r.data),
  add: (teamId: string, data: { userId: string; role: TeamRole }) =>
    api.post<TeamMember>(`/teams/${teamId}/members`, data).then((r) => r.data),
  updateRole: (teamId: string, memberId: string, role: TeamRole) =>
    api.patch<TeamMember>(`/teams/${teamId}/members/${memberId}`, { role }).then((r) => r.data),
  remove: (teamId: string, memberId: string) =>
    api.delete(`/teams/${teamId}/members/${memberId}`),
  myTeams: () => api.get<UserTeamMembership[]>('/users/me/teams').then((r) => r.data),
  searchUsers: (q: string) =>
    api.get<UserSearchResult[]>('/users/search', { params: { q } }).then((r) => r.data),
};

// ─── Permissions (Phase 5 Sprint 6) ──────────────────────────────────────────
export interface TeamRoleInfo {
  role: string | null;
  isOwner: boolean;
  permissions: string[];
}

export const permissionsApi = {
  myTeamRole: (teamId: string) =>
    api.get<TeamRoleInfo>(`/teams/${teamId}/my-role`).then((r) => r.data),
};

// ─── Profile (Phase 5 Sprint 5) ──────────────────────────────────────────────
export const profileApi = {
  get: () => api.get<UserProfile>('/profile').then((r) => r.data),
  update: (data: Partial<UserProfile>) =>
    api.patch<UserProfile>('/profile', data).then((r) => r.data),
};

// ─── Player Portal (Phase 5 Sprint 5) ────────────────────────────────────────
export const playerPortalApi = {
  dashboard: () => api.get<PlayerDashboard>('/player/dashboard').then((r) => r.data),
  stats: () => api.get('/player/stats').then((r) => r.data),
  teams: () => api.get('/player/teams').then((r) => r.data),
  linkPlayer: (playerId: string) =>
    api.post('/player/link', { playerId }).then((r) => r.data),
  unlinkPlayer: (playerId: string) =>
    api.delete(`/player/link/${playerId}`).then((r) => r.data),
};

// ─── Coach Portal (Phase 5 Sprint 5) ─────────────────────────────────────────
export const coachPortalApi = {
  dashboard: () => api.get<CoachDashboard>('/coach/dashboard').then((r) => r.data),
  teams: () => api.get('/coach/teams').then((r) => r.data),
  stats: () => api.get('/coach/stats').then((r) => r.data),
};

// ─── Invitations (Phase 5 Sprint 4) ──────────────────────────────────────────
export const invitationsApi = {
  listByTeam: (teamId: string) =>
    api.get<Invitation[]>(`/teams/${teamId}/invitations`).then((r) => r.data),
  create: (teamId: string, data: { email: string; role: TeamRole }) =>
    api.post<Invitation>(`/teams/${teamId}/invitations`, data).then((r) => r.data),
  accept: (token: string) =>
    api.post<Invitation>(`/invitations/${token}/accept`).then((r) => r.data),
  decline: (token: string) =>
    api.post<Invitation>(`/invitations/${token}/decline`).then((r) => r.data),
  myInvitations: () =>
    api.get<Invitation[]>('/users/me/invitations').then((r) => r.data),
};

export default api;
