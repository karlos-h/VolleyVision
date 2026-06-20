// Types mirror the Prisma schema. Keeping them in sync manually is fine for
// Phase 1. Phase 2 can introduce tRPC or OpenAPI codegen to automate this.

// ─── Auth (Phase 5 Sprint 1) ──────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'COACH' | 'PLAYER' | 'VIEWER';

export type TeamRole = 'HEAD_COACH' | 'ASSISTANT_COACH' | 'STATISTICIAN' | 'PLAYER' | 'VIEWER';

export interface TeamMember {
  id: string; // membership id
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    profileImage: string | null;
  };
}

export interface UserTeamMembership {
  id: string;
  role: TeamRole;
  joinedAt: string;
  team: {
    id: string;
    name: string;
    division?: string;
    season: string;
    ownerId?: string | null;
    _count?: { players: number; matches: number };
  };
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

// ─── Profile (Phase 5 Sprint 5) ───────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profileImage: string | null;
  bio: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
}

export interface PlayerRecord {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: Position;
  teamId: string;
  userId: string | null;
  team: { id: string; name: string; division: string | null; season: string };
}

// CareerStats mirrors StatLine — same shape, defined here so it can be referenced
// before StatLine is declared later in the file
export interface CareerStats {
  kills: number;
  attackAttempts: number;
  attackErrors: number;
  hittingPercentage: number | null;
  aces: number;
  serviceErrors: number;
  serveAttempts: number;
  serveInPercentage: number | null;
  passAttempts: number;
  passingRating: number | null;
  soloBlocks: number;
  blockAssists: number;
  totalBlocks: number;
  blockErrors: number;
  digs: number;
  digErrors: number;
  assists: number;
  settingErrors: number;
  totalEvents: number;
}

export interface MatchSummaryItem {
  id: string;
  matchDate: string;
  opponent: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  homeSetsWon: number;
  awaySetsWon: number;
  competition: string | null;
  team: { id: string; name: string };
}

export interface DevelopmentPoint extends CareerStats {
  matchId: string;
  opponent: string;
  matchDate: string;
}

export interface PlayerDashboard {
  players: PlayerRecord[];
  careerStats: CareerStats | null;
  recentMatches: MatchSummaryItem[];
  developmentMetrics: DevelopmentPoint[];
}

export interface TeamSummary {
  id: string;
  name: string;
  division: string | null;
  season: string;
  _count: { players: number; matches: number };
  memberRole?: string;
}

export interface CoachingStats {
  teamsOwned: number;
  teamsCoached: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winPercentage: number | null;
}

export interface CoachDashboard {
  ownedTeams: TeamSummary[];
  memberTeams: TeamSummary[];
  coachingStats: CoachingStats;
  recentMatches: MatchSummaryItem[];
}

// Phase 7 Sprint 0 — onboarding hint only. Never used for permission checks.
export type SignupIntent = 'COACH' | 'PLAYER' | 'UNSURE';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profileImage: string | null;
  signupIntent?: SignupIntent | null;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type Position =
  | 'SETTER'
  | 'OUTSIDE_HITTER'
  | 'OPPOSITE'
  | 'MIDDLE_BLOCKER'
  | 'LIBERO'
  | 'DEFENSIVE_SPECIALIST';

export type EventType =
  // Attacking
  | 'KILL'
  | 'ATTACK_ERROR'
  | 'ATTACK_ATTEMPT'
  // Serving
  | 'ACE'
  | 'SERVICE_ERROR'
  | 'SERVE_IN'
  // Passing
  | 'PASS_3'
  | 'PASS_2'
  | 'PASS_1'
  | 'PASS_0'
  // Blocking
  | 'SOLO_BLOCK'
  | 'BLOCK_ASSIST'
  | 'BLOCK_ERROR'
  // Defence
  | 'DIG'
  | 'DIG_ERROR'
  // Setting
  | 'ASSIST'
  | 'SETTING_ERROR';

export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TeamOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  division?: string;
  season: string;
  // Phase 5 Sprint 2 — optional because existing teams have no owner
  ownerId?: string | null;
  owner?: TeamOwner | null;
  createdAt: string;
  updatedAt: string;
  _count?: { players: number; matches: number };
  players?: Player[];
  matches?: Match[];
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: Position;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  matchDate: string;
  opponent: string;
  competition?: string;
  venue?: string;
  status: MatchStatus;
  teamId: string;
  team?: Team;
  setScores?: SetScore[];
  // Phase 4 Sprint 1 — live scoring (default 0 on new matches)
  homeScore?: number;
  awayScore?: number;
  homeSetsWon?: number;
  awaySetsWon?: number;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number };
}

export interface SetScore {
  set: number;
  home: number;
  away: number;
}

export type HeatmapData = Record<'attack' | 'serve' | 'pass' | 'block' | 'defence' | 'all', Record<string, number>>;
export type ZoneCounts = Record<string, number>;

export interface ZoneAttack  { kills: number; errors: number; attempts: number; hittingPct: number | null }
export interface ZoneServe   { aces: number; errors: number; serveIn: number; attempts: number; efficiency: number | null }
export interface ZonePass    { pass3: number; pass2: number; pass1: number; pass0: number; attempts: number; rating: number | null }
export interface ZoneDefence { digs: number; soloBlocks: number; blockAssists: number; total: number }
export interface DetailedHeatmapData {
  attack:  Record<string, ZoneAttack>;
  serve:   Record<string, ZoneServe>;
  pass:    Record<string, ZonePass>;
  defence: Record<string, ZoneDefence>;
}

export interface MatchReport {
  generatedAt: string;
  result: {
    teamName: string;
    opponent: string;
    homeSetsWon: number;
    awaySetsWon: number;
    winner: 'home' | 'away' | 'in_progress';
    resultText: string;
    setScores: { set: number; home: number; away: number }[];
  };
  topPerformer: {
    player: Pick<Player, 'firstName' | 'lastName' | 'jerseyNumber' | 'position'>;
    kills: number;
    aces: number;
    blocks: number;
    digs: number;
    assists: number;
  } | null;
  momentum: {
    longestRun: number;
    longestRunTeam: string;
    leadChanges: number;
    largestHomeLead: number;
    largestAwayLead: number;
  } | null;
  attack: {
    killRate: number | null;
    hittingPct: number | null;
    kills: number;
    errors: number;
    attempts: number;
  };
  serve: {
    aceRate: number | null;
    aces: number;
    attempts: number;
  };
  heatMapHighlight: string | null;
  bestRotation: {
    rotation: number;
    won: number;
    lost: number;
    net: number;
    efficiency: number | null;
  } | null;
}

export interface AdvancedMetrics {
  sideOut: {
    attempts: number;
    qualityPasses: number;
    efficiencyPct: number | null;
    perfectPassRate: number | null;
    pass3: number;
    pass2: number;
    pass1: number;
    pass0: number;
  };
  serve: {
    attempts: number;
    aces: number;
    errors: number;
    aceRate: number | null;
    errorRate: number | null;
    positiveRate: number | null;
  };
  attack: {
    attempts: number;
    kills: number;
    errors: number;
    killRate: number | null;
    hittingPct: number | null;
  };
  blocking: {
    soloBlocks: number;
    blockAssists: number;
    totalBlocks: number;
    blocksPerSet: number | null;
  };
  setsPlayed: number;
}

export interface RotationStat {
  rotation: number;
  won: number;
  lost: number;
  total: number;
  net: number;
  efficiency: number | null;
}

export interface RotationData {
  rotations: RotationStat[];
  insights: {
    best: RotationStat | null;
    worst: RotationStat | null;
    highestSideOut: RotationStat | null;
    lowestSideOut: RotationStat | null;
  };
}

export interface MomentumPoint {
  pointNumber: number;
  scorer: 'home' | 'away';
  homeScore: number;
  awayScore: number;
  lead: number;
  setNumber: number;
  runLength: number;
}

export interface MomentumData {
  timeline: MomentumPoint[];
  stats: {
    totalPoints: number;
    longestHomeRun: number;
    longestAwayRun: number;
    longestRun: number;
    leadChanges: number;
    largestHomeLead: number;
    largestAwayLead: number;
  };
  significantRuns: { team: 'home' | 'away'; length: number; startPoint: number }[];
}

export interface Event {
  id: string;
  eventType: EventType;
  setNumber: number;
  rallyNumber?: number;
  courtZone?: number | null;
  notes?: string;
  matchId: string;
  playerId: string;
  player?: Pick<Player, 'firstName' | 'lastName' | 'jerseyNumber'>;
  recordedAt: string;
}

export interface StatLine {
  totalEvents: number;
  kills: number;
  attackErrors: number;
  attackAttempts: number;
  hittingPercentage: number | null;
  aces: number;
  serviceErrors: number;
  serveAttempts: number;
  serveInPercentage: number | null;
  passAttempts: number;
  passingRating: number | null;
  soloBlocks: number;
  blockAssists: number;
  totalBlocks: number;
  blockErrors: number;
  digs: number;
  digErrors: number;
  assists: number;
  settingErrors: number;
}

export interface PlayerStatLine extends StatLine {
  player: Pick<Player, 'id' | 'firstName' | 'lastName' | 'jerseyNumber' | 'position'>;
}

export interface MatchAnalytics {
  match: Pick<
    Match,
    'id' | 'matchDate' | 'opponent' | 'competition' | 'venue' | 'status' | 'setScores' | 'teamId'
  > & {
    teamName: string;
    homeScore: number;
    awayScore: number;
    homeSetsWon: number;
    awaySetsWon: number;
  };
  teamStats: StatLine;
  playerStats: PlayerStatLine[];
  setStats: Array<StatLine & { setNumber: number }>;
}

export interface TeamAnalytics {
  team: Pick<Team, 'id' | 'name' | 'division' | 'season'>;
  matchSummary: {
    total: number;
    completed: number;
    inProgress: number;
    scheduled: number;
  };
  teamStats: StatLine;
  playerStats: PlayerStatLine[];
}

export interface PlayerAnalytics {
  player: Pick<
    Player,
    'id' | 'firstName' | 'lastName' | 'jerseyNumber' | 'position' | 'teamId'
  >;

  matchId: string | null;

  stats: StatLine;

  setStats: Array<StatLine & { setNumber: number }>;
}

export interface TeamInsight {
  type: 'positive' | 'warning' | 'neutral';
  message: string;
}

// ─── Coaching Recommendations (Phase 6 Sprint 1) ─────────────────────────────

export interface Recommendation {
  category: 'attack' | 'serve' | 'pass' | 'defence' | 'rotation';
  priority: 'high' | 'medium' | 'low';
  message: string;
}

// ─── Player Development (Phase 6 Sprint 2) ───────────────────────────────────

export interface PlayerDevelopmentReport {
  strengths:      string[];
  weaknesses:     string[];
  mostImproved:   { category: string; change: string } | null;
  needsAttention: { category: string; change: string } | null;
  trend:          'improving' | 'declining' | 'stable' | 'insufficient_data';
}

// ─── Season Intelligence (Phase 6 Sprint 4) ──────────────────────────────────

export interface SeasonInsight {
  category: 'kills' | 'aces' | 'blocks' | 'digs' | 'hittingPercentage';
  message: string;
  direction: 'positive' | 'negative';
}

export interface SeasonIntelligenceReport {
  seasonAverages: {
    kills: number;
    aces: number;
    blocks: number;
    digs: number;
    hittingPercentage: number | null;
  };
  insights: SeasonInsight[];
  trajectory: 'improving' | 'declining' | 'mixed' | 'insufficient_data';
}

// ─── Phase 7 — Video upload & timestamp tagging ──────────────────────────────

export interface Video {
  id:               string;
  matchId:          string;
  filename:         string;
  filePath:         string;
  mimeType:         string;
  uploadedAt:       string;
  uploadedByUserId: string;
}

export interface VideoTimestamp {
  id:               string;
  videoId:          string;
  timestampSeconds: number;
  label:            string;
  eventId:          string | null;
}

// ─── Phase 7 — Multi-team player links ───────────────────────────────────────

export interface TeamSummary {
  id:       string;
  name:     string;
  division: string | null;
  season:   string;
}

export interface PlayerTeamLink {
  linkId:   string;
  team:     TeamSummary;
  linkedAt: string;
}

export interface PlayerTeamsResponse {
  homeTeam:    TeamSummary;
  linkedTeams: PlayerTeamLink[];
}

// ─── Phase 6 Sprint 5 — Training Recommendations ─────────────────────────────

export interface TrainingRecommendation {
  focus:         string;
  category:      'attack' | 'serve' | 'pass' | 'defence' | 'rotation' | 'player_development';
  allocationPct: number;
  rationale:     string;
}

export interface AssistantAnswer {
  matchedIntent: string | null;
  answer:        string;
}

// ─── Event metadata (UI helpers) ─────────────────────────────────────────────

export interface EventMeta {
  type: EventType;
  label: string;
  category: 'attack' | 'serve' | 'pass' | 'block' | 'defence' | 'set';
  // positive = adds a point / good outcome; negative = error; neutral = attempt
  outcome: 'positive' | 'negative' | 'neutral';
}

export const EVENT_META: EventMeta[] = [
  // Attacking
  { type: 'KILL', label: 'Kill', category: 'attack', outcome: 'positive' },
  { type: 'ATTACK_ERROR', label: 'Att. Error', category: 'attack', outcome: 'negative' },
  { type: 'ATTACK_ATTEMPT', label: 'Attempt', category: 'attack', outcome: 'neutral' },
  // Serving
  { type: 'ACE', label: 'Ace', category: 'serve', outcome: 'positive' },
  { type: 'SERVICE_ERROR', label: 'Svc Error', category: 'serve', outcome: 'negative' },
  { type: 'SERVE_IN', label: 'Serve In', category: 'serve', outcome: 'neutral' },
  // Passing
  { type: 'PASS_3', label: 'Pass 3', category: 'pass', outcome: 'positive' },
  { type: 'PASS_2', label: 'Pass 2', category: 'pass', outcome: 'neutral' },
  { type: 'PASS_1', label: 'Pass 1', category: 'pass', outcome: 'neutral' },
  { type: 'PASS_0', label: 'Pass 0', category: 'pass', outcome: 'negative' },
  // Blocking
  { type: 'SOLO_BLOCK', label: 'Solo Block', category: 'block', outcome: 'positive' },
  { type: 'BLOCK_ASSIST', label: 'Blk Assist', category: 'block', outcome: 'positive' },
  { type: 'BLOCK_ERROR', label: 'Blk Error', category: 'block', outcome: 'negative' },
  // Defence
  { type: 'DIG', label: 'Dig', category: 'defence', outcome: 'positive' },
  { type: 'DIG_ERROR', label: 'Dig Error', category: 'defence', outcome: 'negative' },
  // Setting
  { type: 'ASSIST', label: 'Assist', category: 'set', outcome: 'positive' },
  { type: 'SETTING_ERROR', label: 'Set Error', category: 'set', outcome: 'negative' },
];

export const POSITION_LABELS: Record<Position, string> = {
  SETTER: 'S',
  OUTSIDE_HITTER: 'OH',
  OPPOSITE: 'OPP',
  MIDDLE_BLOCKER: 'MB',
  LIBERO: 'L',
  DEFENSIVE_SPECIALIST: 'DS',
};

// ─── Invitations (Phase 5 Sprint 4) ──────────────────────────────────────────

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface Invitation {
  id: string;
  email: string;
  teamId: string;
  invitedById: string;
  role: TeamRole;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  team?: { id: string; name: string; division?: string; season: string };
  invitedBy?: { id: string; firstName: string; lastName: string; email: string };
}

// ─── Opponent Scouting (Phase 6 Sprint 3) ────────────────────────────────────

export interface JerseyTally {
  jerseyNumber: number;
  kills: number;
  aces: number;
  errors: number;
}

export interface OpponentScoutingReport {
  insufficientData: false;
  totalEvents: number;
  zoneBreakdown: {
    attack: Record<string, { kills: number; errors: number; attempts: number; hittingPct: number | null }>;
    serve: Record<string, { aces: number; errors: number; serveIn: number; attempts: number; efficiency: number | null }>;
    pass: Record<string, { pass3: number; pass2: number; pass1: number; pass0: number; attempts: number; rating: number | null }>;
    defence: Record<string, { digs: number; soloBlocks: number; blockAssists: number; total: number }>;
  };
  dominantErrorType: string | null;
  dominantErrorCount: number;
  jerseyTallies: JerseyTally[] | null;
}

export interface OpponentScoutingInsufficient {
  insufficientData: true;
  totalEvents: number;
}

export type OpponentScoutingResult = OpponentScoutingReport | OpponentScoutingInsufficient;
