# Region move runbook (Singapore to Sydney)

Supabase can't change a project's region in place, and the Free org allows **two ACTIVE projects** (paused ones don't count). So each environment moves the same way: export from the old project, pause it, create the new project in Sydney (`ap-southeast-2`), import from local files. **Staging goes first (R6) as the rehearsal; production (R7) repeats it.**

**[KARLOS]** = you at a terminal or a dashboard. **[CLAUDE]** = Claude Code, in a session you start. Commands show names only: never paste a value into chat, and never into a file in the repo.

Old projects (the import scripts refuse both as targets): prod `rkkhrmhorgdqkxflipui`, staging `lnzircweyhwiemspuaav`.

## What moves, what doesn't

| Moves | How |
|---|---|
| Postgres data (`public` schema) | `scripts\move-db.ps1` (custom-format `pg_dump`, restored with `pg_restore`) |
| Schema, RLS, grant revokes | `prisma migrate deploy` run by the import (it also applies any migration newer than the export) |
| Storage buckets and files (`team-chat`: chat and feedback attachments) | `backend/scripts/copy-storage.ts` |
| Full Supabase URLs in rows | `backend/scripts/rewrite-storage-urls.ts`. Only `users.profile_image` holds one; `MessageAttachment.storagePath` and `FeedbackAttachment.storagePath` store object paths (signed URLs are minted on read), so they need nothing. The script scans every text column to prove it. |

Doesn't move: Supabase project settings, API keys (the new project has its own), `auth.*` (the app doesn't use Supabase Auth), anything outside `public`.

## Rules for the export folder

It holds everyone's data in plain text, and the storage export holds user files (players can be minors). Keep it **outside the repo** (both scripts refuse a folder inside it), e.g. `D:\vv-move-staging` and `D:\vv-move-prod`. Delete it when the 7-day fallback ends (C8), not before.

## Common set-up, once per terminal **[KARLOS]**

Use the **Session pooler** string (Supabase, Connect, Session pooler; port 5432). Your network is IPv4-only and the direct host is IPv6-only. Set the variables in the terminal you run the scripts from; each script clears its own database variable when it finishes.

Don't type a connection string: PSReadLine saves every command line to disk. Either turn history off for the session first (`Set-PSReadLineOption -HistorySaveStyle SaveNothing`), or read the value from a file. `backend\.env.staging`'s `DIRECT_URL` is the old staging project's session pooler string, so for the staging export:

```powershell
Set-PSReadLineOption -HistorySaveStyle SaveNothing
$env:OLD_DB_URL = ((Get-Content backend\.env.staging | Where-Object { $_ -like 'DIRECT_URL=*' }) -replace '^DIRECT_URL=', '').Trim('"', "'")
$env:NEW_DB_URL = '<new project session pooler string>'   # import only; paste after SaveNothing
```

For non-interactive runs, `-ConfirmRef <ref>` (or `$env:MOVE_CONFIRM_REF`) replaces the typed-ref prompt. You normally type the ref instead.

## Staging (R6)

Timing: about 30 minutes. No users to warn.

1. **[KARLOS]** Safety copy of the old staging database. Docker running, then:
   ```powershell
   .\backup.ps1 -EnvFile backend\.env.staging -OutDir D:\Backups
   ```
   (Without `-EnvFile`, `backup.ps1` reads `backend/.env`, which points at production. Expect `Backup saved: ...`.)
2. **[KARLOS]** Export the database:
   ```powershell
   $env:OLD_DB_URL = ((Get-Content backend\.env.staging | Where-Object { $_ -like 'DIRECT_URL=*' }) -replace '^DIRECT_URL=', '').Trim('"', "'")
   .\scripts\move-db.ps1 -Export -From lnzircweyhwiemspuaav -Out D:\vv-move-staging
   ```
   Type the ref when asked. Expect a table with `data.dump written`, `counts.json` and `migrations.json` all `PASS`.
3. **[KARLOS]** Export storage (dry run first, then for real):
   ```powershell
   $env:OLD_SUPABASE_URL = '<old staging project URL>'
   $env:OLD_SERVICE_ROLE_KEY = '<old staging service-role key>'
   cd backend
   npx ts-node --transpile-only scripts/copy-storage.ts --export --to-dir D:\vv-move-staging\storage
   npx ts-node --transpile-only scripts/copy-storage.ts --export --to-dir D:\vv-move-staging\storage --apply
   ```
   Expect one `PASS` line per bucket (`team-chat`), with object count and bytes.
4. **[KARLOS]** Pause the old staging project (Supabase dashboard, Project Settings, General, Pause project). This frees the active slot: **pause first, then create**.
5. **[KARLOS]** Create the new project in Sydney: name `volleyvision-staging-syd`, region **Oceania (Sydney)**. Note its ref, the Session pooler string, the project URL and the service-role key. Tell Claude the ref (not a secret).
6. **[KARLOS]** Import the database:
   ```powershell
   $env:NEW_DB_URL = '<new staging session pooler string>'
   .\scripts\move-db.ps1 -Import -To <newref> -In D:\vv-move-staging
   ```
   Expect `Import verified.` and this table, all `PASS`:
   `prisma migrate deploy`, `target is empty before restore`, `pg_restore`, `row counts match`, `old migrations are a prefix of the new`, `extra migrations = those added since export` (lists the 9.6 migrations), `RLS on for every public table`, `no anon/authenticated grants`, `no sequences in use (ids are cuids)`. Any `FAIL` ends in exit 1: stop and tell Claude.
7. **[KARLOS]** Import storage:
   ```powershell
   $env:NEW_SUPABASE_URL = '<new staging project URL>'
   $env:NEW_SERVICE_ROLE_KEY = '<new staging service-role key>'
   cd backend
   npx ts-node --transpile-only scripts/copy-storage.ts --import --from-dir D:\vv-move-staging\storage
   npx ts-node --transpile-only scripts/copy-storage.ts --import --from-dir D:\vv-move-staging\storage --apply
   ```
   Expect `PASS ... match the manifest` per bucket.
8. **[KARLOS]** Rewrite stored URLs (dry run, then apply). The `DATABASE_URL` here is the NEW project's:
   ```powershell
   $env:DATABASE_URL = '<new staging session pooler string>'
   cd backend
   npx ts-node --transpile-only scripts/rewrite-storage-urls.ts
   npx ts-node --transpile-only scripts/rewrite-storage-urls.ts --apply --old-ref lnzircweyhwiemspuaav --new-ref <newref>
   Remove-Item Env:DATABASE_URL
   ```
   Expect the dry run to list `users.profile_image` (or "no hits" if nobody has a photo) and nothing else; if another column shows `<- unexpected`, stop and tell Claude. After apply: `PASS: no column names the old project any more.`
9. **[KARLOS]** Point staging at the new project: set the staging secrets on the Fly app `volleyvision-api-staging` and in the Netlify staging site's env (dashboard only; Claude never runs `netlify env:*`). Names: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STAGING_PROJECT_REF` (the new ref). Full table and how to set them without shell history: `docs/fly-setup.md` and `docs/staging-setup.md`. Update `backend/.env.staging` (gitignored) the same way.
10. **[KARLOS]** Set the FULL Fly secret set on `volleyvision-api-staging`, not just the four above: the whole table in `docs/fly-setup.md`, including `JWT_SECRET` (the staging site's value), `CLIENT_URL`, `CORS_EXTRA_ORIGINS` (must include `https://localhost,capacitor://localhost`, or every installed Android app fails every call), the `SMTP_*` set, `SENTRY_DSN` and `SUPABASE_CHAT_BUCKET`. Then set `API_PROXY_SIGNING_SECRET` to the same random value on the Netlify staging site (dashboard, Runtime scope) and on the Fly app. Staging and prod get different values.
11. **[CLAUDE]** Deploy and check the API directly, from `backend/`: `fly deploy -c fly.staging.toml --ha=false`, then `curl https://volleyvision-api-staging.fly.dev/health/live` (expect 200) and `curl https://volleyvision-api-staging.fly.dev/health` (expect 403: an unsigned direct call is refused, which proves the signature check is on).
12. **[KARLOS]** Deploy the frontend as a draft first: `.\deploy.ps1 -Target staging -Draft -ApiOrigin fly`, then `.\deploy.ps1 -Target staging -ApiOrigin fly` once the draft looks right. The smoke check runs after it.
13. **[CLAUDE]** Check `/health` THROUGH the Netlify URL (`https://volleyvision-staging.netlify.app/health`): expect 200 (proves the signed proxy works). Then verify: `node backend/scripts/smoke.mjs https://volleyvision-staging.netlify.app`, plus the speed measurements in `docs/performance.md` (the point of the move). Report the table.
14. **[KARLOS]** Before the production window: **pause the Sydney staging project** so a Sydney production project can be active (limit: 2 active; production's old project stays active until the very end of its own window). Staging is unpaused again whenever you want to rehearse.

Staging rollback: unpause the old staging project (pause the new one first if two others are active) and put the old staging values back in the env. Nothing else was changed.

## Production (R7)

Timing: **a 60-minute window.** There is no maintenance flag in the app. **Announce the window beforehand** (players and coaches: "VolleyVision will be unavailable between X and Y"). **Writes made after the export starts are lost**: stat entries, chat, sign-ups. Don't let anyone track a live match during it. The old app keeps answering until the cut-over, so tell people to stop, not just warn them.

Prerequisites (do not start the window without both): the R3 header investigation on staging (`docs/fly-setup.md`, "Headers seen on Fly") confirmed Netlify forwards the client IP through the signed proxy, and `CORS_EXTRA_ORIGINS` is verified on the Fly prod app (it includes `https://localhost,capacitor://localhost`).

Before the window **[KARLOS]**: staging move done and verified; Sydney staging paused (staging step 14); export folders `D:\vv-move-prod` ready on a drive with room; Docker running; the new-project values to hand.

| Min | Step |
|---|---|
| 0 | Announce the window has started |
| 0-5 | 1 (safety copy) |
| 5-15 | 2-3 (export) |
| 15-20 | 4-5 (create the Sydney project) |
| 20-35 | 6-8 (import, storage, URLs) |
| 35-50 | 8-11 (env, secrets, Fly and Netlify deploys) |
| 50-60 | 12-14 (verify, reopen). Pausing the old project (15) comes later. |

1. **[KARLOS]** Safety copy: `.\backup.ps1` (its default output folder, `$HOME\Backups`: `deploy.ps1 -Target prod` looks for today's file there and aborts without it). Expect `Backup saved: ...`.
2. **[KARLOS]** Export the database:
   ```powershell
   $env:OLD_DB_URL = '<old prod session pooler string>'
   .\scripts\move-db.ps1 -Export -From rkkhrmhorgdqkxflipui -Out D:\vv-move-prod
   ```
   All three rows `PASS`. This is the moment the data is frozen: anything written after it is lost.
3. **[KARLOS]** Export storage (`--to-dir D:\vv-move-prod\storage`, as in staging step 3 with the production `OLD_SUPABASE_URL` and `OLD_SERVICE_ROLE_KEY`).
4. **[KARLOS]** Create the Sydney project (`volleyvision-prod-syd`, region Oceania (Sydney)). **Do not pause the old production project yet** (see "The old function" below): the 2-active limit is satisfied because Sydney staging is paused, so old prod and new prod are the two active ones. If the dashboard refuses to create it, the staging project isn't paused.
5. **[KARLOS]** Import the database: `.\scripts\move-db.ps1 -Import -To <newref> -In D:\vv-move-prod` with `NEW_DB_URL` set. Every row `PASS` (as staging step 6). **Do not go on after a FAIL**; tell Claude.
6. **[KARLOS]** Import storage (`--from-dir D:\vv-move-prod\storage`, dry run then `--apply`; as staging step 7).
7. **[KARLOS]** Rewrite URLs: `--apply --old-ref rkkhrmhorgdqkxflipui --new-ref <newref>`, with `DATABASE_URL` the NEW project's (as staging step 8).
8. **[KARLOS]** Point `backend/.env` (gitignored) `DATABASE_URL` and `DIRECT_URL` at the NEW prod project's session-pooler strings, as the staging sequence does for `.env.staging`. Otherwise `deploy.ps1 -Target prod` runs `prisma migrate status` against the OLD project, which lacks `20261012000000_revoked_tokens` (the new project has it after the import), and aborts mid-window.
9. **[KARLOS]** Set the production secrets on the Fly app `volleyvision-api` and in the Netlify prod env (dashboard only): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the rest of the FULL set in the `docs/fly-setup.md` table: `JWT_SECRET`, `CLIENT_URL`, `CORS_EXTRA_ORIGINS`, the `SMTP_*` set, `SENTRY_DSN`, `SUPABASE_CHAT_BUCKET`. `JWT_SECRET` must be the SAME value the Netlify production site uses today: a different one signs every existing session out at the cut-over. `CORS_EXTRA_ORIGINS` must include `https://localhost,capacitor://localhost`, or every installed Android app fails every call. Set `API_PROXY_SIGNING_SECRET` to the same random value on the Netlify prod site (Runtime scope) and the Fly app; it must be DIFFERENT from staging's.
10. **[CLAUDE]** From `backend/`, on Karlos's go: `fly deploy -c fly.prod.toml --ha=false`. Then `curl https://volleyvision-api.fly.dev/health/live` (expect 200) and `curl https://volleyvision-api.fly.dev/health` (expect 403: unsigned direct call refused, so the signature check is on).
11. **[KARLOS]** Deploy the frontend: `.\deploy.ps1 -Target prod -ApiOrigin fly` (`-ApiOrigin` is mandatory for prod). It aborts on pending migrations (none: the import applied them and step 8 points it at the new project) and runs the smoke check.
12. **[CLAUDE]** Verify against prod: `node backend/scripts/smoke.mjs https://volleyvision-app.netlify.app`, and check `/health` THROUGH the Netlify URL (`https://volleyvision-app.netlify.app/health`) returns 200 and says `db ok` (proves the signed proxy works). **[KARLOS]** On the web: sign in, open a team and a match, open a chat attachment and a profile photo. **[KARLOS]** On the Android phone: sign in, Home, open a match.
13. **[KARLOS]** Announce the app is open again. **From here on, writes go to the new database. Rollback is roll-forward only.**
14. **[CLAUDE]** Record the move in `docs/audit/AUDIT-LOG.md` and the progress file.
15. **[KARLOS]** Last step of the window: pause the old production project (Supabase dashboard, Pause project). Not earlier: see below.

### The old function

The Netlify Function stays reachable at `/.netlify/functions/api/...` on production after the cut-over, and it still points at the OLD database (its env was not changed). That is the rollback path, and also a trap: anything calling it keeps writing to the old, stale database. That is why pausing the old project is the **last** step: it makes the old function fail loudly instead of quietly writing into a dead copy. Don't pause until steps 12-13 are clean.

### Rollback

- **Before reopening (steps 1-12, nothing announced as open):** the old database is still the truth, nothing was written to the new one that matters. Unpause the old project if you had paused it (**pause the new Sydney project first**: two active at most), put the old values back in the Fly secrets / Netlify env, and redeploy the frontend against the Netlify Function: `.\deploy.ps1 -Target prod -ApiOrigin function`. Announce a delay. Retry another day. `-ApiOrigin` is mandatory for `-Target prod` (there is no default for prod any more), so a routine prod deploy after a rollback can't silently point prod back at Fly: pass `function` or `fly` deliberately every time.
- **After reopening (step 13 onwards):** **roll forward only.** The old database is stale as of the export and anything entered since is only in the new one. Fix the problem on the new project (re-run `scripts\move-db.ps1 -Import` is NOT possible: the target is no longer empty, by design). If it is truly unrecoverable, restore from the `backup.ps1` safety copy into a fresh project and accept losing what was written since step 1.
- The 7-day fallback (C8): keep the paused old project and `D:\vv-move-prod` until it passes, then delete the project and the folder.

## If something fails

| Symptom | Likely cause |
|---|---|
| `REFUSED: ... old project` | URL or `-To` names a Singapore project. Use the new project's string. |
| `REFUSED: ... doesn't contain the ref` | The URL is for a different project than the ref you typed. |
| `Docker is not running` | Start Docker Desktop. |
| `docker/postgres command failed` on connect | Wrong string, or the direct host (IPv6). Use the Session pooler (port 5432). |
| `target already holds data` | Not a fresh project (or a half-finished earlier import). Delete the new project and create another; don't hand-clean it. |
| `pg_restore` fails on a foreign key | `--data-only` restores in the dump's dependency order, which worked in the local rehearsal (21 tables, no workaround needed). If a table ever fails, restore it on its own after its parents: `pg_restore --data-only --no-owner --exit-on-error --table=<parent> ...` then the child. Tell Claude first. |
| `row counts match` FAIL | Someone wrote during the export, or the restore was cut short. The new project is not verified: do not reopen. |
| `extra migrations` FAIL | The repo's migrations folder is a different branch from the one the old project was deployed from. Check out the deployed tag and re-import into a fresh project. |
| Storage `FAIL` | Re-run `--import --apply`: uploads are upserts, so it is safe to repeat. |

## Secret names, in one place

`OLD_DB_URL`, `NEW_DB_URL`, `OLD_SUPABASE_URL`, `OLD_SERVICE_ROLE_KEY`, `NEW_SUPABASE_URL`, `NEW_SERVICE_ROLE_KEY`, `DATABASE_URL` (rewrite step only) are terminal variables, set in the shell for the move and never written to a file. The Fly and Netlify names are in `docs/fly-setup.md`.
