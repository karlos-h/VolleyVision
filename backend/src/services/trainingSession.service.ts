import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// Iteration 3 — Training sessions, foundation only. Basic create/list scoped to
// a team. Recording stats against a session (Event.trainingSessionId) and any
// player-facing views come in a later pass — see the schema comment on
// TrainingSession. Staff-only enforcement lives in the route (TRACK_MATCH).

const sessionSelect = {
  id: true,
  teamId: true,
  sessionDate: true,
  durationMinutes: true,
  location: true,
  notes: true,
  createdByUserId: true,
  createdAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { events: true } },
} as const;

export async function createTrainingSession(input: {
  teamId: string;
  createdByUserId: string;
  sessionDate: Date;
  durationMinutes?: number | null;
  location?: string | null;
  notes?: string | null;
}) {
  const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { id: true } });
  if (!team) throw new AppError(404, 'Team not found.');

  return prisma.trainingSession.create({
    data: {
      teamId: input.teamId,
      createdByUserId: input.createdByUserId,
      sessionDate: input.sessionDate,
      durationMinutes: input.durationMinutes ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
    },
    select: sessionSelect,
  });
}

export async function listTrainingSessions(teamId: string) {
  return prisma.trainingSession.findMany({
    where: { teamId },
    orderBy: { sessionDate: 'desc' },
    select: sessionSelect,
  });
}
