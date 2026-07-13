# Team visibility (public vs. private)

_Added in Stabilization Pass 2._

## Mental model

Every team has an `isPublic` boolean (default `true`).

- **Public** — anyone, logged in or not, may read the team's roster, matches,
  dashboards, and analytics.
- **Private** — only the **team owner**, an accepted **TeamMembership** on that
  team, or a global **ADMIN** may read it. To everyone else the team behaves as
  if it does not exist: reads return **404, not 403**, so a private team's id is
  never leaked.

## Where it lives

- **Schema**: `Team.isPublic Boolean @default(true)` (migration
  `add_team_visibility`). Default `true` preserves pre-existing behaviour.
- **New-team default**: `DEFAULT_TEAM_VISIBILITY` env var (`public` | `private`)
  only pre-fills the create-team toggle; the coach chooses per team. The DB
  column default stays `true`. **Flip the env to `private` before production.**
  Exposed to the client via `GET /api/v1/config`.
- **Single rule**: `backend/src/lib/teamVisibility.ts`
  (`isTeamVisibleTo` / `assertTeamVisible` / `defaultTeamIsPublic`).
- **Enforcement**: `backend/src/middleware/visibility.ts` provides
  `visibleByTeamParam` / `visibleByMatchParam` / `visibleByPlayerParam`. Each is
  paired with `optionalAuth` (so `req.user` is set when a token is present) in
  front of every team-scoped read route: teams, players, matches, events,
  analytics. The team-list controller (`getTeams`) filters the list with the
  same rule (public + owned + member; admin sees all).
- **Admin**: `role = 'ADMIN'` bypasses all visibility checks. Set it with
  `npx ts-node scripts/ensure-admin.ts <email>`.

## Frontend

Routes stay outside `<RequireAuth>` so public teams remain viewable logged-out.
Because the backend 404s hidden teams, the pages' existing not-found / error
states ("Team not found.", "Couldn't load …") handle the denied case — no
separate access-denied UI. The create-team form and TeamDetailPage expose the
Public/Private toggle (the latter gated by `MANAGE_TEAM`).
