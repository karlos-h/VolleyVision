import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import Layout from './components/ui/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyTeamsPage from './pages/MyTeamsPage';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import MatchesPage from './pages/MatchesPage';
import TrackingPage from './pages/TrackingPage';
import MatchDashboardPage from './pages/MatchDashboardPage';
import TeamDashboardPage from './pages/TeamDashboardPage';
import PlayersDashboardPage from './pages/PlayersDashboardPage';

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
        <Routes>
          {/* Auth pages — standalone, no Layout chrome */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Main app */}
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/teams" replace />} />
            <Route path="/my-teams" element={<MyTeamsPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/teams/:teamId/matches" element={<MatchesPage />} />
            <Route path="/teams/:teamId/dashboard" element={<TeamDashboardPage />} />
            <Route path="/matches/:matchId/dashboard" element={<MatchDashboardPage />} />
            <Route path="/players/:playerId/dashboard" element={<PlayersDashboardPage />} />
            {/* Tracking screen hides the nav — full focus mode */}
            <Route path="/track/:matchId" element={<TrackingPage />} />
          </Route>
        </Routes>
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
