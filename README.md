# VolleyVision — Phase 1: Match Tracking System

A volleyball analytics platform built as a portfolio project for Information Systems & Business Analytics.

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18 · TypeScript · Tailwind CSS |
| Backend    | Node.js · Express · TypeScript      |
| Database   | PostgreSQL                          |
| ORM        | Prisma                              |
| State      | TanStack Query (React Query)        |
| Routing    | React Router v6                     |

---

## Project Structure

```
volleyvision/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       ← Database schema
│   │   └── seed.ts             ← Sample data
│   └── src/
│       ├── controllers/        ← Business logic (teams, players, matches, events)
│       ├── routes/             ← Express route definitions
│       ├── middleware/         ← Error handling
│       ├── lib/prisma.ts       ← DB client singleton
│       └── index.ts            ← App entry point
└── frontend/
    └── src/
        ├── pages/              ← TeamsPage, TeamDetailPage, MatchesPage, TrackingPage
        ├── components/ui/      ← Layout, shared UI
        ├── hooks/              ← React Query hooks
        ├── lib/api.ts          ← Axios API client
        ├── types/              ← Shared TypeScript types
        └── index.css           ← Tailwind + component classes
```

---

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+ (running locally or via Docker)
- **npm** or **pnpm**

---

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd volleyvision

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set up PostgreSQL

Option A — Local PostgreSQL:
```bash
createdb volleyvision
```

Option B — Docker (recommended for portability):
```bash
docker run --name volleyvision-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=volleyvision \
  -p 5433:5433 \
  -d postgres:16
```

### 3. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env and set your DATABASE_URL
```

Default `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5433/volleyvision"
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### 4. Run Prisma migrations and seed

```bash
cd backend
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:seed        # Load sample team, players, and a match
```

To open Prisma Studio (visual DB browser):
```bash
npm run db:studio
```

### 5. Start the backend

```bash
cd backend
npm run dev
# → API running at http://localhost:3001
# → Health check: http://localhost:3001/health
```

### 6. Start the frontend

```bash
cd frontend
npm run dev
# → App running at http://localhost:5173
```

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Teams
| Method | Path | Description |
|--------|------|-------------|
| GET | `/teams` | List all teams |
| GET | `/teams/:id` | Get team with roster + recent matches |
| POST | `/teams` | Create team |
| PATCH | `/teams/:id` | Update team |
| DELETE | `/teams/:id` | Delete team |

### Players
| Method | Path | Description |
|--------|------|-------------|
| GET | `/players/by-team/:teamId` | Get roster for a team |
| GET | `/players/:id` | Get player |
| POST | `/players` | Create player |
| PATCH | `/players/:id` | Update player |
| DELETE | `/players/:id` | Delete player |

### Matches
| Method | Path | Description |
|--------|------|-------------|
| GET | `/matches/by-team/:teamId` | Get matches for a team |
| GET | `/matches/:id` | Get match with team and roster |
| POST | `/matches` | Create match |
| PATCH | `/matches/:id` | Update match (status, scores) |
| DELETE | `/matches/:id` | Delete match |

### Events
| Method | Path | Description |
|--------|------|-------------|
| POST | `/events` | Record an event |
| GET | `/events/by-match/:matchId` | Get all events for a match |
| DELETE | `/events/undo/:matchId` | Delete the most recent event (undo) |
| DELETE | `/events/:id` | Delete a specific event |

---

## Volleyball Events

| Code | Label | Category | Outcome |
|------|-------|----------|---------|
| KILL | Kill | Attack | ✅ Positive |
| ATTACK_ERROR | Att. Error | Attack | ❌ Negative |
| ATTACK_ATTEMPT | Attempt | Attack | ➖ Neutral |
| ACE | Ace | Serve | ✅ |
| SERVICE_ERROR | Svc Error | Serve | ❌ |
| SERVE_IN | Serve In | Serve | ➖ |
| PASS_3 | Pass 3 | Pass | ✅ |
| PASS_2 | Pass 2 | Pass | ➖ |
| PASS_1 | Pass 1 | Pass | ➖ |
| PASS_0 | Pass 0 | Pass | ❌ |
| SOLO_BLOCK | Solo Block | Block | ✅ |
| BLOCK_ASSIST | Blk Assist | Block | ✅ |
| BLOCK_ERROR | Blk Error | Block | ❌ |
| DIG | Dig | Defence | ✅ |
| DIG_ERROR | Dig Error | Defence | ❌ |
| ASSIST | Assist | Set | ✅ |
| SETTING_ERROR | Set Error | Set | ❌ |

---

## Workflow

```
1. Create a Team          /teams
2. Add Players            /teams/:id (Roster tab)
3. Create a Match         /teams/:id/matches
4. Start Tracking         /track/:matchId
   - Select player from roster
   - Tap event buttons to record
   - Switch sets with the set selector (1–5)
   - Use ↩ Undo to remove the last event
   - Toggle match status LIVE / COMPLETED
```

---

## Architectural Decisions

### Why Prisma over raw SQL?
Type-safe queries mean the TypeScript compiler catches schema changes before they reach production. For a portfolio project, it also demonstrates ORM proficiency while keeping migrations declarative and version-controlled.

### Why is `events` the central fact table?
Every Phase 2–5 analytics calculation aggregates from `events`. The schema is deliberately minimal (no score state stored per event) but indexed on `(matchId, setNumber)`, `(playerId, eventType)`, and `recordedAt` — the three most common slice patterns in volleyball analytics.

### Why JSON for `setScores`?
A separate `SetScore` table would require a join on every match list page for a field that only matters when displaying a completed scoreline. JSON keeps Phase 1 fast. Phase 2 can normalise this with a migration if aggregation performance requires it.

### Why TanStack Query?
Courtside data must feel instant. React Query handles caching, background refetch (5s polling during live matches), and optimistic updates without a Redux boilerplate overhead. For Phase 2 dashboards, the same query layer will handle computed stats.

### Why versioned API routes (`/api/v1`)?
A tablet app locked on a specific version should not break when Phase 2 introduces breaking changes to the events schema. `/api/v2` can coexist.

### Why `rallyNumber` in the schema?
Not used in Phase 1 UI, but Phase 3 heat maps and rotation analysis need to know which events belong to the same rally. Adding it now costs nothing and avoids a destructive migration later.

---

## Recommended Next Steps (Phase 2)

1. **Player stats API** — aggregate kills, errors, hitting %, passing rating per player per match
2. **Match summary** — set-by-set score entry, final result
3. **Player dashboard** — visualise per-match trends with Recharts
4. **Team dashboard** — team hitting %, side-out efficiency
5. **Authentication** — JWT + role-based access (Statistician, Coach, Viewer)
6. **CSV export** — pipe `events` into a template for coach review

---

## Portfolio Notes

This project demonstrates:
- Full-stack TypeScript monorepo architecture
- Relational database design with scalability built in
- RESTful API design with versioning
- React Query for server state management
- Mobile-first, tablet-optimised UX for real-time data entry
- Professional folder structure matching industry patterns
