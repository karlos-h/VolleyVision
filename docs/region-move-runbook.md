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

```powershell
$env:OLD_DB_URL = '<old project session pooler string>'   # export only
$env:NEW_DB_URL = '<new project session pooler string>'   # import only
```

For non-interactive runs, `-ConfirmRef <ref>` (or `$env:MOVE_CONFIRM_REF`) replaces the typed-ref prompt. You normally type the ref instead.

## Staging (R6)

Timing: about 30 minutes. No users to warn.

1. **[KARLOS]** Safety copy of the old staging database. Docker running, then:
   ```powershell
   .\backup.ps1 -OutDir D:\Backups
   ```
   (`backup.ps1` reads `backend/.env`, which points at production. For staging, point it at the staging file: `.\backup.ps1 -EnvFile backend\.env.staging -OutDir D:\Backups`. Expect `Backup saved: ...`.)
2. **[KARLOS]** Export the database:
   ```powershell
   $env:OLD_DB_URL = '<old staging session pooler string>'
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
10. **[KARLOS]** Deploy staging: `.\deploy.ps1 -Target staging`. The smoke check runs after it.
11. **[CLAUDE]** Verify: `node backend/scripts/smoke.mjs https://volleyvision-staging.netlify.app`, plus the speed measurements in `docs/performance.md` (the point of the move). Report the table.
12. **[KARLOS]** Before the production window: **pause the Sydney staging project** so a Sydney production project can be active (limit: 2 active; production's old project stays active until the very end of its own window). Staging is unpaused again whenever you want to rehearse.

Staging rollback: unpause the old staging project (pause the new one first if two others are active) and put the old staging values back in the env. Nothing else was changed.

## Production (R7)

Timing: **a 60-minute window.** There is no maintenance flag in the app. **Announce the window beforehand** (players and coaches: "VolleyVision will be unavailable between X and Y"). **Writes made after the export starts are lost**: stat entries, chat, sign-ups. Don't let anyone track a live match during it. The old app keeps answering until the cut-over, so tell people to stop, not just warn them.

Before the window **[KARLOS]**: staging move done and verified; Sydney staging paused (staging step 12); export folders `D:\vv-move-prod` ready on a drive with room; Docker running; the new-project values to hand.

| Min | Step |
|---|---|
| 0 | Announce the window has started |
| 0-5 | 1 (safety copy) |
| 5-15 | 2-3 (export) |
| 15-20 | 4-5 (create the Sydney project) |
| 20-35 | 6-8 (import, storage, URLs) |
| 35-50 | 9-10 (secrets, deploy, smoke) |
| 50-60 | 11-12 (verify, reopen). Pausing the old project (13) comes later. |

1. **[KARLOS]** Safety copy: `.\backup.ps1 -OutDir D:\Backups`. Expect `Backup saved: ...`.
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
8. **[KARLOS]** Set the production secrets on the Fly app `volleyvision-api` and in the Netlify prod env: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`docs/fly-setup.md`). `JWT_SECRET` stays the same (a new one signs everybody out). Redeploy the Fly app so it picks them up.
9. **[KARLOS]** Deploy the frontend: `.\deploy.ps1 -Target prod`. It aborts on pending migrations (none, the import applied them) and runs the smoke check.
10. **[CLAUDE]** Verify against prod: `node backend/scripts/smoke.mjs https://volleyvision-app.netlify.app`, and check `/health` says `db ok`. **[KARLOS]** Sign in, open a team and a match, open a chat attachment and a profile photo.
11. **[KARLOS]** Announce the app is open again. **From here on, writes go to the new database. Rollback is roll-forward only.**
12. **[CLAUDE]** Record the move in `docs/audit/AUDIT-LOG.md` and the progress file.
13. **[KARLOS]** Last step of the window: pause the old production project (Supabase dashboard, Pause project). Not earlier: see below.

### The old function

The Netlify Function stays reachable at `/.netlify/functions/api/...` on production after the cut-over, and it still points at the OLD database (its env was not changed). That is the rollback path, and also a trap: anything calling it keeps writing to the old, stale database. That is why pausing the old project is the **last** step: it makes the old function fail loudly instead of quietly writing into a dead copy. Don't pause until step 10-11 are clean.

### Rollback

- **Before reopening (steps 1-10, nothing announced as open):** the old database is still the truth, nothing was written to the new one that matters. Unpause the old project if you had paused it (**pause the new Sydney project first**: two active at most), put the old values back in the Fly secrets / Netlify env, and redeploy the frontend against the Netlify Function: `.\deploy.ps1 -Target prod -ApiOrigin function`. Announce a delay. Retry another day.
- **After reopening (step 11 onwards):** **roll forward only.** The old database is stale as of the export and anything entered since is only in the new one. Fix the problem on the new project (re-run `scripts\move-db.ps1 -Import` is NOT possible: the target is no longer empty, by design). If it is truly unrecoverable, restore from the `backup.ps1` safety copy into a fresh project and accept losing what was written since step 1.
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
