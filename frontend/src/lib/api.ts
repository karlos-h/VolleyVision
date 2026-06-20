import axios from 'axios';
import type { Team, Player, Match, Event, MatchAnalytics, TeamAnalytics, PlayerAnalytics, HeatmapData, ZoneCounts, MomentumData, RotationData, AdvancedMetrics, MatchReport, User, AuthResponse, TeamOwner, TeamMember, TeamRole, UserTeamMembership, UserSearchResult, Invitation, UserProfile, PlayerDashboard, CoachDashboard, DetailedHeatmapData, Recommendation, PlayerDevelopmentReport, SeasonIntelligenceReport, TrainingRecommendation, AssistantAnswer, PlayerTeamsResponse, Video, VideoTimestamp } from '../types';
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
  register: (data: { email: string; password: string; firstName: string; lastName: string; signupIntent?: string | null }) =>
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
  // Phase 7 — multi-team links
  getTeams: (playerId: string) =>
    api.get<PlayerTeamsResponse>(`/players/${playerId}/teams`).then((r) => r.data),
  addTeamLink: (playerId: string, teamId: string) =>
    api.post(`/players/${playerId}/team-links`, { teamId }).then((r) => r.data),
  removeTeamLink: (playerId: string, teamId: string) =>
    api.delete(`/players/${playerId}/team-links/${teamId}`),
};

// ─── Matches ──────────────────────────────────────────────────────────────────
export const matchesApi = {
  listByTeam: (teamId: string, filters?: { opponent?: string; status?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (filters?.opponent) params.set('opponent', filters.opponent);
    if (filters?.status)   params.set('status', filters.status);
    if (filters?.from)     params.set('from', filters.from);
    if (filters?.to)       params.set('to', filters.to);
    const qs = params.toString();
    return api.get<Match[]>(`/matches/by-team/${teamId}${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
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
    playerId?: string;
    eventType: string;
    setNumber: number;
    rallyNumber?: number;
    courtZone?: number | null;
    rotationNumber?: number | null;
    notes?: string;
    isOpponentEvent?: boolean;
    opponentJerseyNumber?: number | null;
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

  teamTrainingRecommendations: (teamId: string) =>
    api.get<TrainingRecommendation[]>(`/analytics/teams/${teamId}/training-recommendations`).then((r) => r.data),

  askAssistant: (teamId: string, question: string) =>
    api.post<AssistantAnswer>(`/analytics/teams/${teamId}/ask`, { question }).then((r) => r.data),

  opponentScoutingReport: (matchId: string) =>
    api.get<import('../types').OpponentScoutingResult>(`/analytics/matches/${matchId}/opponent-report`).then((r) => r.data),
};

// ─── Videos (Phase 7) ─────────────────────────────────────────────────────────
export const videosApi = {
  listByMatch: (matchId: string) =>
    api.get<Video[]>(`/matches/${matchId}/videos`).then((r) => r.data),
  upload: (matchId: string, file: File) => {
    const fd = new FormData();
    fd.append('video', file);
    return api.post<Video>(`/matches/${matchId}/videos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  delete: (videoId: string) => api.delete(`/videos/${videoId}`),
  fileUrl: (videoId: string) => `/api/v1/videos/${videoId}/file`,

  listTimestamps: (videoId: string) =>
    api.get<VideoTimestamp[]>(`/videos/${videoId}/timestamps`).then((r) => r.data),
  createTimestamp: (videoId: string, data: { timestampSeconds: number; label: string; eventId?: string }) =>
    api.post<VideoTimestamp>(`/videos/${videoId}/timestamps`, data).then((r) => r.data),
  deleteTimestamp: (timestampId: string) => api.delete(`/timestamps/${timestampId}`),
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

// ─── League Intelligence (Phase 7 Sprints 1-3) ───────────────────────────────
import type { League, LeagueSeason, LeagueMatch, StandingsResult, FixtureFilters } from '../types';

export const leagueApi = {
  list: () =>
    api.get<League[]>('/leagues').then((r) => r.data),
  listMy: () =>
    api.get<LeagueSeason[]>('/leagues/my').then((r) => r.data),
  create: (data: { name: string; division?: string }) =>
    api.post<League>('/leagues', data).then((r) => r.data),
  get: (leagueId: string) =>
    api.get<League>(`/leagues/${leagueId}`).then((r) => r.data),

  createSeason: (leagueId: string, data: { name: string; startDate: string; endDate?: string }) =>
    api.post<LeagueSeason>(`/leagues/${leagueId}/seasons`, data).then((r) => r.data),
  getSeason: (seasonId: string) =>
    api.get<LeagueSeason>(`/leagues/seasons/${seasonId}`).then((r) => r.data),

  addTeam: (seasonId: string, teamId: string) =>
    api.post(`/leagues/seasons/${seasonId}/teams`, { teamId }).then((r) => r.data),
  removeTeam: (seasonId: string, leagueTeamId: string) =>
    api.delete(`/leagues/seasons/${seasonId}/teams/${leagueTeamId}`),

  listFixtures: (seasonId: string, filters?: FixtureFilters) => {
    const params: Record<string, string> = {};
    if (filters?.teamId) params.teamId = filters.teamId;
    if (filters?.from)   params.from   = filters.from;
    if (filters?.to)     params.to     = filters.to;
    if (filters?.status) params.status = filters.status;
    return api.get<LeagueMatch[]>(`/leagues/seasons/${seasonId}/fixtures`, { params }).then((r) => r.data);
  },
  createFixture: (seasonId: string, data: { homeLeagueTeamId: string; awayLeagueTeamId: string; scheduledDate: string }) =>
    api.post<LeagueMatch>(`/leagues/seasons/${seasonId}/fixtures`, data).then((r) => r.data),
  getFixture: (fixtureId: string) =>
    api.get<LeagueMatch>(`/leagues/fixtures/${fixtureId}`).then((r) => r.data),

  linkMatch: (fixtureId: string, matchId: string, side: 'home' | 'away') =>
    api.patch<LeagueMatch>(`/leagues/fixtures/${fixtureId}/link`, { matchId, side }).then((r) => r.data),
  unlinkMatch: (fixtureId: string, side: 'home' | 'away') =>
    api.patch<LeagueMatch>(`/leagues/fixtures/${fixtureId}/unlink`, { side }).then((r) => r.data),

  getStandings: (seasonId: string) =>
    api.get<StandingsResult>(`/leagues/seasons/${seasonId}/standings`).then((r) => r.data),
};

export default api;
