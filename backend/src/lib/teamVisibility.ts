import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Team visibility model (Stabilization Pass 2)
 * ────────────────────────────────────────────
 * A team is either public (`isPublic = true`, the default) or private.
 *
 * - Public team  → anyone, logged in or not, may read its roster, matches,
 *   dashboards, and analytics.
 * - Private team → only the team owner, an accepted TeamMembership on that team,
 *   or a global ADMIN may read it. Everyone else is treated as if the team does
 *   not exist (404, not 403) so a private team's id is never leaked.
 *
 * This helper is the single source of truth for that rule. It is enforced in
 * middleware (see middleware/visibility.ts) in front of every team-scoped read
 * endpoint, and reused by the team-list controller to filter results.
 */
export async function isTeamVisibleTo(teamId: string, userId: string | null): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { isPublic: true, ownerId: true },
  });
  if (!team) return false;             // non-existent team → not visible
  if (team.isPublic) return true;      // public → everyone

  if (!userId) return false;           // private + anonymous → hidden

  if (team.ownerId === userId) return true;

  // Global admins bypass visibility entirely.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'ADMIN') return true;

  // Accepted membership on this team.
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { id: true },
  });
  return !!membership;
}

/**
 * Throws AppError(404) when the caller may not see the team. Use this in
 * controllers/middleware so hidden private teams are indistinguishable from
 * teams that do not exist.
 */
export async function assertTeamVisible(teamId: string, userId: string | null): Promise<void> {
  const visible = await isTeamVisibleTo(teamId, userId);
  if (!visible) throw new AppError(404, 'Team not found.');
}

/** Resolved default visibility for newly created teams, from DEFAULT_TEAM_VISIBILITY. */
export function defaultTeamIsPublic(): boolean {
  return (process.env.DEFAULT_TEAM_VISIBILITY ?? 'public').toLowerCase() !== 'private';
}
