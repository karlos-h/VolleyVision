# Performance: measuring and the speed pass (Phase 9.5)

## How to measure

- **`Server-Timing` header** (`backend/src/lib/serverTiming.ts`): every response on staging and local carries
  `db;dur=<ms>;desc="ops=<n>", app;dur=<ms>, cold;desc="0|1", fn;desc="<AWS_REGION>"`. `ops` counts Prisma
  operations in the request (raw SQL and work inside interactive transactions included; BEGIN/COMMIT not), `db` is the
  sum of their durations (parallel operations add up, so it can exceed `app`), `app` is the whole request inside
  Express, `cold` is 1 on an instance's first request, `fn` is the function's region (Netlify only). It is **never on
  in production**: the count differs between a hidden team's 404 and a missing one's, which would undo the
  404-not-403 rule, so there is deliberately no switch for it.
- **`node backend/scripts/measure.mjs <url> [--runs N] [--md]`**: signs in once as the `SMOKE_*` user and calls the
  key endpoints N times (run 1 is "first"), printing wall ms and the header's fields; `--md` prints the summary table
  below. Needs `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `SMOKE_TEAM_ID`, `SMOKE_MATCH_ID`. Locally use `http://127.0.0.1:3001`.
- **Browser**: Sentry's `browserTracingIntegration` (10% sample) records page-load, navigation and fetch spans; URLs in
  them are scrubbed by `scrubTransaction` (join codes, invitation tokens, query strings).

## Baseline, before the speed pass

**Local stack, 6 Oct 2026** (`backend-localdb` → Docker `vv-pg17` on the same PC, owner of a team with one live match;
5 runs each, median). No Netlify credits, so this is local rather than the planned staging draft: **the operation
counts are exact, the milliseconds are not representative**. Each operation here costs ~2–10 ms; from the Netlify
function (Ohio by default) to the Singapore database it is ~200 ms, so multiply `ops` by ~0.2 s for the real cost.

| endpoint | status | min ms | median ms | median db ms | ops | cold | region |
|---|---|---|---|---|---|---|---|
| GET /health | 200 | 8.0 | 8.8 | 4 | 1 | 0 | - |
| GET /auth/me | 200 | 14.4 | 16.5 | 9 | 2 | 0 | - |
| GET /coach/dashboard | 200 | 23.5 | 38.1 | 124 | 12 | 0 | - |
| GET /analytics/teams/:id | 200 | 23.0 | 30.5 | 47 | 6 | 0 | - |
| GET /teams/:id/my-role | 200 | 18.1 | 19.5 | 22 | 6 | 0 | - |
| GET /analytics/matches/:id | 200 | 26.9 | 31.8 | 35 | 6 | 0 | - |
| GET /events/by-match/:id | 200 | 17.9 | 22.4 | 25 | 6 | 0 | - |

Reading it: Home (`/coach/dashboard`) does 12 operations, of which 6 re-read the same team ids; a guarded read
(`/analytics/*`, `/events/by-match`, `/teams/:id/my-role`) does 6 even for the owner (auth, visibility, role,
permissions, then the data). `fn` is "-" because `AWS_REGION` only exists on Netlify.

**Targets** (from the handoff): Home ≤ 5 ops, a guarded GET ≤ 5, `/my-role` ≤ 3, `/auth/me` 1–2, auth check and page
data in parallel on the client, Sentry flush only on errors.

## After the speed pass

(Filled in at 9.5.11, same method. Re-run on a staging draft deploy once Netlify credits return, so `fn` and the real
per-operation cost are recorded.)

## Database connection settings

(9.5.8.)
