import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import teamRoutes from './routes/teams';
import playerRoutes from './routes/players';
import matchRoutes from './routes/matches';
import eventRoutes from './routes/events';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import invitationRoutes from './routes/invitations';
import profileRoutes from './routes/profile';
import playerPortalRoutes from './routes/playerPortal';
import coachPortalRoutes from './routes/coachPortal';
import auditRoutes from './routes/audit';
import videoRoutes from './routes/videos';
import leagueRoutes from './routes/league';
import configRoutes from './routes/config';
import approvalRoutes from './routes/approvals';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(morgan('dev'));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
// All routes versioned under /api/v1 so Phase 2+ can introduce /api/v2 without
// breaking existing clients (e.g. a tablet app locked on an old version).
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/player', playerPortalRoutes);
app.use('/api/v1/coach', coachPortalRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1', videoRoutes);
app.use('/api/v1/leagues', leagueRoutes);
app.use('/api/v1/approval-requests', approvalRoutes);

// Health check — useful for deployment monitoring and CI pipelines
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'VolleyVision API', version: '1.0.0' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n⚡ VolleyVision API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

export default app;
