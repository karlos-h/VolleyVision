import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { ViewModeProvider } from './context/ViewModeContext';
import { features } from './config/features';
import Layout from './components/ui/Layout';
import RequireAuth from './components/ui/RequireAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RedeemInvitationPage from './pages/RedeemInvitationPage';
import InvitationsPage from './pages/InvitationsPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import PlayerPortalPage from './pages/PlayerPortalPage';
import CoachDashboardPage from './pages/CoachDashboardPage';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import MatchesPage from './pages/MatchesPage';
import TrackingPage from './pages/TrackingPage';
import MatchDashboardPage from './pages/MatchDashboardPage';
import MatchEventsPage from './pages/MatchEventsPage';
import MatchWatchPage from './pages/MatchWatchPage';
import TeamDashboardPage from './pages/TeamDashboardPage';
import PlayersDashboardPage from './pages/PlayersDashboardPage';
import OnboardingCoachPage from './pages/OnboardingCoachPage';
import OnboardingPlayerPage from './pages/OnboardingPlayerPage';
import LeagueHubPage from './pages/LeagueHubPage';
import LeagueSeasonPage from './pages/LeagueSeasonPage';
import LeagueSeasonStandingsPage from './pages/LeagueSeasonStandingsPage';
import FixturesPage from './pages/FixturesPage';
import ResultsPage from './pages/ResultsPage';
import LeagueTeamProfilePage from './pages/LeagueTeamProfilePage';
import LeagueSeasonRankingsPage from './pages/LeagueSeasonRankingsPage';
import MatchCentrePage from './pages/MatchCentrePage';
import TeamChatPage from './pages/TeamChatPage';
import FeedbackPage from './pages/FeedbackPage';

// Backward-compat redirect: live tracking moved under the shared match shell at
// /matches/:matchId/track. Old bookmarks to /track/:matchId land here.
function LegacyTrackRedirect() {
  const { matchId } = useParams<{ matchId: string }>();
  return <Navigate to={`/matches/${matchId}/track`} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ViewModeProvider>
        <Routes>
          {/* Auth pages — standalone, no Layout chrome */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Password reset — public; the emailed token is the credential */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {/* Invitation redemption — public so brand-new / logged-out invitees can join */}
          <Route path="/invitations/redeem" element={<RedeemInvitationPage />} />
          {/* Post-registration onboarding nudges — one-time, intent-driven */}
          <Route path="/onboarding/coach" element={<OnboardingCoachPage />} />
          <Route path="/onboarding/player" element={<OnboardingPlayerPage />} />

          {/* Main app */}
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Protected routes — require a logged-in user */}
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/player" element={<PlayerPortalPage />} />
              <Route path="/coach" element={<CoachDashboardPage />} />
              {/* "My Teams" merged into /teams — teams are members-only, so
                  there is no separate "browse all teams" list any more. */}
              <Route path="/my-teams" element={<Navigate to="/teams" replace />} />
              <Route path="/invitations" element={<InvitationsPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/track/:matchId" element={<LegacyTrackRedirect />} />
              {/* Team-scoped routes. Teams are private to their members, so
                  every one of these 404s for a non-member on the backend —
                  there is nothing here to read while logged out. */}
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:teamId" element={<TeamDetailPage />} />
              <Route path="/teams/:teamId/matches" element={<MatchesPage />} />
              <Route path="/teams/:teamId/dashboard" element={<TeamDashboardPage />} />
              {features.teamChat && (
                <Route path="/teams/:teamId/chat" element={<TeamChatPage />} />
              )}
              <Route path="/matches/:matchId/dashboard" element={<MatchDashboardPage />} />
              <Route path="/matches/:matchId/events" element={<MatchEventsPage />} />
              <Route path="/matches/:matchId/track" element={<TrackingPage />} />
              <Route path="/matches/:matchId/watch" element={<MatchWatchPage />} />
              <Route path="/players/:playerId/dashboard" element={<PlayersDashboardPage />} />

              {features.leagues && (
                <>
                  <Route path="/leagues" element={<LeagueHubPage />} />
                  <Route path="/leagues/seasons/:seasonId" element={<LeagueSeasonPage />} />
                  <Route path="/leagues/seasons/:seasonId/standings" element={<LeagueSeasonStandingsPage />} />
                  <Route path="/leagues/seasons/:seasonId/fixtures" element={<FixturesPage />} />
                  <Route path="/leagues/seasons/:seasonId/results" element={<ResultsPage />} />
                  <Route path="/leagues/seasons/:seasonId/rankings" element={<LeagueSeasonRankingsPage />} />
                  <Route path="/leagues/seasons/:seasonId/match-centre" element={<MatchCentrePage />} />
                  <Route path="/leagues/league-teams/:leagueTeamId/profile" element={<LeagueTeamProfilePage />} />
                </>
              )}
            </Route>
          </Route>
        </Routes>
        </ViewModeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
