# Region decision (for Karlos, after 23 Oct)

**Written 6 Oct 2026 from the Phase 9.5 measurements** (`docs/performance.md`). Nothing here is changed by the code; it
is your call once the Netlify credits reset.

## What the numbers say

After the speed pass a page costs about this many database operations: Home 4 (web) + 4 (invitations badge) + 2
(`/auth/me`, no longer blocking); a team or match dashboard 5 per panel (analytics, report 8, zones 4) with no second
`/my-role` request; the tracker 5 + 5 and a 5-op poll every 5 s. Each operation is one round trip from the function to
the database:

| Function ↔ database | Per operation | A 5-op guarded read | Home (4 ops, lite) |
|---|---|---|---|
| Ohio ↔ Singapore (today, assumed) | ~200 ms | ~1.0 s | ~0.8 s |
| Same region (Singapore ↔ Singapore, or Ohio ↔ Ohio) | ~1–2 ms | ~10 ms | ~8 ms |

Add one browser-to-function round trip per request (NZ → Ohio ~180–200 ms, NZ → Singapore ~130 ms, NZ → Sydney
~30–40 ms) and a cold start on the first request to a fresh instance. The query trimming (12 → 4 on Home, 9 → 3 on
`/my-role`) halves the distance cost; it cannot remove it. Only putting the function and the database in the same
region does that.

(Caveat: the function's region hasn't been read yet — 9.5.1's `fn` field reports it on the first staging draft deploy.
Netlify's default is Ohio; if it turns out to be elsewhere, the per-operation figure changes but the conclusion doesn't.)

## Options

| Option | Cost | Work | Expected page cost (guarded read, from NZ) |
|---|---|---|---|
| **A. Netlify Pro + function region `sin`** (Singapore, next to the DB) | US$20/month; also lifts the credit cap (3,000 credits ≈ 200 deploys) | A dashboard setting plus one redeploy | ~10 ms DB + ~130 ms RTT ≈ **0.15–0.3 s** |
| **B. Move the database to the US** (new Supabase project in `us-east-2`, Ohio) | Free | High: `pg_dump`/restore, the chat-attachment bucket and files, env vars, downtime, the privacy policy's "Singapore" and `docs/store` | ~10 ms DB + ~190 ms RTT ≈ **0.2–0.4 s** |
| **C. Netlify Pro + `syd`, and Supabase moved to Sydney** (`ap-southeast-2`) | US$20/month plus the database move | High (as B) | ~10 ms DB + ~35 ms RTT ≈ **0.05–0.15 s** |
| **D. Stay as is** | Free | None | ~1.0 s DB + ~190 ms RTT ≈ **1.2–1.5 s** per guarded read, plus cold starts |

## Recommendation

**A.** It is the only option that is a setting rather than a migration, it removes ~95% of the remaining page time, and
the same US$20 lifts the deploy-credit ceiling that blocked production on 3 Oct. B is free but moves everyone's data
across the Pacific for a smaller gain than A; C is the best end state for New Zealand users but needs the database move
on top, so it can wait until there are enough users to feel the difference between 0.2 s and 0.1 s. D is workable for a
small beta thanks to the speed pass, but every guarded read still spends about a second on distance.

**How to check A before paying for a month:** nothing to try for free — the region setting is Pro-only. After switching,
run `node backend/scripts/measure.mjs <staging draft url>` and compare `db;dur` and `fn` against `docs/performance.md`.
