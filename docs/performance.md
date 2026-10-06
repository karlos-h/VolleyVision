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

## After the speed pass (9.5.2–9.5.7)

Same method, same local stack, same owner account, 6 Oct 2026, after 9.5.2 (Home), 9.5.4 (per-request memo), 9.5.6
(rate limiter) and 9.5.7 (`viewer` block):

| endpoint | status | min ms | median ms | median db ms | ops | cold | region |
|---|---|---|---|---|---|---|---|
| GET /health | 200 | 8.1 | 8.3 | 3 | 1 | 0 | - |
| GET /auth/me | 200 | 11.5 | 13.9 | 8 | 2 | 0 | - |
| GET /coach/dashboard | 200 | 23.5 | 30.6 | 49 | 6 | 0 | - |
| GET /analytics/teams/:id | 200 | 22.9 | 31.7 | 48 | 5 | 0 | - |
| GET /teams/:id/my-role | 200 | 16.2 | 17.1 | 12 | 3 | 0 | - |
| GET /analytics/matches/:id | 200 | 30.6 | 31.3 | 31 | 5 | 0 | - |
| GET /events/by-match/:id | 200 | 20.3 | 22.2 | 22 | 5 | 0 | - |

Plus, from the same session: `/coach/dashboard?lite=1` (what the web sends) **4 ops**; `GET /matches/:id` **5** (now
carrying `viewer`); match `report` 8, `zones` 4, `rotations` 4, `momentum` 4, `advanced` 5; team `zones` 3;
`GET /teams/:id` 4; `players/by-team` 4; `users/me/invitations` 4.

| Page / call | Before (ops) | After (ops) | Target |
|---|---|---|---|
| `/coach/dashboard` (web, `lite`) | 12 | **4** | ≤ 5 |
| `/coach/dashboard` (installed apps, full) | 12 | 6 | – |
| `/auth/me` | 2 | 2 | 1–2 |
| A guarded team/match GET | 6 | **5** | ≤ 5 |
| `/teams/:id/my-role` | 6 owner / 9 member | **3** | ≤ 3 |
| Match dashboard's second `/my-role` request | 6–9 + a round trip | **gone** (`viewer` in the analytics response) | – |
| Home page to content | 3-step waterfall | auth check, page chunk and data **in parallel** (9.5.3) | parallel |
| Sampled requests (10%) | wait for a Sentry upload | **only errors wait** (9.5.5) | errors only |
| Rate-limited write (single key) | interactive transaction (4–5 statements) | **1 statement** (~29 → 11 ms locally) | – |

**Tracking batch and polling (9.5.7, recorded, not changed):** `POST /events/batch` costs 12 ops for 1 event and
44–56 for 5 (≈ 8–11 per event: each event runs in its own transaction holding the match row lock, by design; the local
run uses the in-memory limiter, so add one statement in production). The tracker's and events page's 5-second polls
cost 5 ops each (`GET /matches/:id`, `GET /events/by-match/:id`); hidden tabs don't poll (TanStack Query's default).
The per-event cost is the next thing worth looking at after the region decision — recorded as a finding.

What a request still costs: one user read (auth), one team and one membership read (visibility + role), then the
data — about 5 operations, each a round trip to the database. From Ohio to Singapore that is ~1 s of pure distance per
guarded read, which is why the region note (`docs/region-decision.md`) matters more than any further query trimming.

**Still to measure on a real deploy** (no Netlify credits on 6 Oct): the `fn` region, the cold-start time before/after
the smaller bundle (9.5.5: Windows engine excluded from the function zip; check the deploy log for the zip size), and
the real per-operation cost. Run `measure.mjs` against a staging draft when credits return and append the table here.

## Database connection settings (9.5.8)

On staging and local the API logs one line at startup, `db pool: connection_limit=<n or Prisma default (2×CPUs+1)>[,
pgbouncer=true]`, parsed from `DATABASE_URL` without ever printing it (`lib/dbPool.ts`). Prisma 5 can't report the pool
it actually opened without the `metrics` preview feature (G1), so the URL is the only honest source.

Why it matters: Home and the guarded reads run several queries in `Promise.all`. With `connection_limit=1` they run
one after another, each paying the Ohio→Singapore round trip; with 3 they overlap. More than a handful per function
instance is pointless (one request at a time per instance) and risks pgbouncer's pool under many warm instances.

**Recommendation:** keep `pgbouncer=true` on the transaction pooler (port 6543) and try `connection_limit=3` — on
**staging first**, set by Karlos in the Netlify dashboard (never `netlify env:*`), then re-run `measure.mjs` on a draft
deploy and compare `db;dur` against the baseline. Production waits until after 23 Oct and Karlos's go-ahead.
