import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import Layout from './components/ui/Layout';
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
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/teams" replace />} />
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
