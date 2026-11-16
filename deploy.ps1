# Deploys VolleyVision (the API to Fly.io, then the frontend to Netlify) to
# production or staging with an accurate deploy message, then runs the smoke
# check against what it deployed. -Target is mandatory: there is no default.
#
# Usage (from repo root):
#   .\deploy.ps1 -Target prod -ApiOrigin fly      # backend (fly deploy), then frontend; message auto-built from git state
#   .\deploy.ps1 -Target staging                  # the same against staging, using backend/.env.staging
#   .\deploy.ps1 -Target prod -ApiOrigin fly -BackendOnly    # only the Fly API (+ /health/live check, smoke on the site)
#   .\deploy.ps1 -Target prod -ApiOrigin fly -FrontendOnly   # only the Netlify site
#   .\deploy.ps1 -Target prod -ApiOrigin function            # rollback: no Fly step, frontend proxies to the Netlify Function
#   -Message "hotfix x"  # explicit message override
#   -SkipMigrationCheck  # skip the pending-migrations check below
#   -Force               # prod from a dirty tree or a branch other than main
#   -NoBackup            # prod without today's backup.ps1 file
#   .\deploy.ps1 -Target staging -Migrate   # prisma migrate deploy against staging, then stop
#   .\deploy.ps1 -Target staging -Seed      # npm run db:seed:staging against staging, then stop
#   .\deploy.ps1 -Target staging -Draft     # Fly staging deploy + a free draft frontend (no --prod) at rehearse-<sha>--<site>.netlify.app
#   .\deploy.ps1 -Target staging -Draft -Alias rehearse   # same, with a fixed draft URL <alias>--<site>.netlify.app
#
# The auto-built message is "<tag> (<sha>): <commit subject>", with a
# "+ uncommitted local changes" suffix when the working tree is dirty —
# so the Netlify Deploys list always says exactly what shipped.
#
# Before deploying, this script runs `npx prisma migrate status` from
# backend/ and aborts the deploy if migrations are pending or the database is
# unreachable. Pass -SkipMigrationCheck to bypass that check. For prod it reads
# backend/.env as before; for staging it loads backend/.env.staging into the
# environment for that step only (real environment variables override Prisma's
# own .env loading) and restores the environment afterwards.
#
# Prod refuses a dirty working tree or a branch other than main unless -Force:
# a prod deploy publishes the working tree, not a git ref. It also refuses
# unless today's backup (backup.ps1, $HOME\Backups\vv-backup-<today>-*.sql)
# exists and isn't empty, unless -NoBackup: the Supabase free plan keeps no
# downloadable backups, so that file is the only way back.
#
# After a successful deploy it runs backend/scripts/smoke.mjs: against prod
# with no credentials (read-only checks), against staging with the SMOKE_*
# values from backend/.env.staging (logs in as the seed users).
#
# Backend (9.6.R8): with -ApiOrigin fly (and not -FrontendOnly) it runs
# `fly deploy -c fly.<target>.toml --ha=false` from backend/ BEFORE the Netlify
# deploy, aborts everything if that fails, then waits up to ~60 s for
# https://<app>.fly.dev/health/live to answer 200. -ApiOrigin function is the
# rollback path: no Fly step, and -BackendOnly is refused. -BackendOnly and
# -FrontendOnly are mutually exclusive; with neither, both run, backend first.
# All parameter checks run first, before any git, network or CLI call.
#
# -Draft (staging only, 9.5.0.8): on Netlify every production publish costs
# credits, the staging site's included; a draft deploy is free. It uploads the
# same local build without --prod, under the alias rehearse-<short sha> (or -Alias), and
# smoke-checks that draft URL (-Alias <name> fixes the alias; the Fly staging
# deploy still happens unless -FrontendOnly). The SPA calls the relative /api/v1, which
# the api-proxy plugin routes to Fly staging (the function with -ApiOrigin function),
# so the draft serves both from one origin (no CORS change). Env vars come from the site's
# dev/deploy-preview context; staging sets every value for all contexts.
#
# Notes:
# - Deploys build LOCALLY (--build) and publish the working tree, not a git
#   ref. --build is load-bearing: it runs netlify.toml's build command with
#   the site's env vars injected. Without it the CLI just uploads whatever
#   frontend/dist already holds, built against a shell that has no
#   VITE_SENTRY_DSN -- and since main.tsx guards Sentry.init on that var,
#   Vite tree-shakes the SDK out entirely and the frontend ships with no
#   error tracking at all, silently. Verified: the dist built that way
#   contains zero Sentry code.
# - Requires the Netlify CLI to be logged in as the himextradingltd
#   account (the KP Enterprise account can read the site but deploys 404).
# - If the schema changed, run `npx prisma migrate deploy` from backend/ first
#   (with backend/.env.staging loaded, for staging).
param(
  # No default: a deploy must name where it goes (checked below, so a missing value
  # fails with a message instead of a PowerShell prompt).
  [ValidateSet('prod', 'staging')][string]$Target,
  [string]$Message,
  [switch]$SkipMigrationCheck,
  [switch]$Force,
  [switch]$NoBackup,
  [switch]$Migrate,
  [switch]$Seed,
  [switch]$Draft,
  [switch]$BackendOnly,
  [switch]$FrontendOnly,
  [string]$Alias,
  # 'function' is the rollback to the Netlify Function (until it is deleted in 9.7).
  # No default: after a rollback to the function, a routine prod deploy must not
  # silently point prod back at Fly. Mandatory for prod (checked below).
  [ValidateSet('fly', 'function')][string]$ApiOrigin
)

$ErrorActionPreference = 'Stop'

$ProdUrl = 'https://volleyvision-app.netlify.app'
# Prod identifiers a staging deploy must never point at (a copy-pasted
# .env.staging would otherwise publish any branch straight to prod).
$ProdSiteId = '7b2795e8-4722-40cf-bb35-b2fc4e17e813'
$ProdProjectRef = 'rkkhrmhorgdqkxflipui'

# Parameter checks first: every refusal below happens before any git, network
# or CLI call.
if (-not $Target) { throw "-Target prod|staging is required (there is no default)." }
if ($BackendOnly -and $FrontendOnly) { throw "-BackendOnly and -FrontendOnly are mutually exclusive." }
if ($BackendOnly -and $ApiOrigin -eq 'function') { throw "-BackendOnly needs -ApiOrigin fly: the Netlify Function has no separate backend deploy." }
if (-not $ApiOrigin) {
  if ($Target -eq 'prod') { throw "-ApiOrigin fly|function is required for -Target prod." }
  $ApiOrigin = 'fly'
}
if ($PSBoundParameters.ContainsKey('Alias')) {
  if (-not $Draft) { throw "-Alias only applies with -Draft." }
  if ($Alias -cnotmatch '^[a-z0-9-]{1,37}$') { throw "-Alias must match ^[a-z0-9-]{1,37}$ (Netlify caps an alias at 37 characters)." }
}
$FlyApp = if ($Target -eq 'staging') { 'vv-api-himex-staging' } else { 'vv-api-himex' }
$RunBackend = ($ApiOrigin -eq 'fly') -and -not $FrontendOnly
$RunFrontend = -not $BackendOnly

# Parses KEY=VALUE lines (comments and blanks skipped, one pair of surrounding
# quotes stripped). Never prints values: the file holds staging secrets.
function Read-EnvFile([string]$Path) {
  $vars = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $vars[$key] = $value
  }
  return $vars
}

# Runs $Block with $Vars set as environment variables, then puts every one of
# them back exactly as it was (including "was unset").
function Invoke-WithEnv([hashtable]$Vars, [scriptblock]$Block) {
  $saved = @{}
  foreach ($key in $Vars.Keys) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $Vars[$key], 'Process')
  }
  try {
    & $Block
  } finally {
    foreach ($key in $saved.Keys) {
      [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process')
    }
  }
}

if (($Migrate -or $Seed) -and $Target -ne 'staging') {
  Write-Host "ABORTED: -Migrate and -Seed are for staging only. Production migrations are run by hand (cd backend; npx prisma migrate deploy), after a backup."
  exit 1
}
if ($Migrate -and $Seed) {
  Write-Host "ABORTED: run -Migrate first, then -Seed, as two commands."
  exit 1
}
if ($Draft -and $Target -ne 'staging') {
  Write-Host "ABORTED: -Draft is for staging only. Production is published for real or not at all."
  exit 1
}
if ($Draft -and ($Migrate -or $Seed)) {
  Write-Host "ABORTED: -Draft deploys; run -Migrate or -Seed as its own command first."
  exit 1
}

$stagingVars = @{}
if ($Target -eq 'staging') {
  $stagingEnvPath = Join-Path $PSScriptRoot 'backend/.env.staging'
  if (-not (Test-Path -LiteralPath $stagingEnvPath)) {
    Write-Host "DEPLOY ABORTED: backend/.env.staging not found (see backend/.env.staging.example)."
    exit 1
  }
  $stagingVars = Read-EnvFile $stagingEnvPath
  foreach ($required in @('DATABASE_URL', 'DIRECT_URL', 'NETLIFY_STAGING_SITE_ID', 'STAGING_URL')) {
    if (-not $stagingVars[$required]) {
      Write-Host "DEPLOY ABORTED: $required is missing from backend/.env.staging."
      exit 1
    }
  }
  if ($stagingVars['NETLIFY_STAGING_SITE_ID'] -eq $ProdSiteId -or $stagingVars['STAGING_URL'].TrimEnd('/') -eq $ProdUrl -or
      $stagingVars['DATABASE_URL'].Contains($ProdProjectRef) -or $stagingVars['DIRECT_URL'].Contains($ProdProjectRef)) {
    Write-Host "DEPLOY ABORTED: backend/.env.staging points at production (site id, URL or database). Fix it before deploying to staging."
    exit 1
  }

  # -Migrate / -Seed: one step against the staging database, then stop. Only
  # the variables that step needs are set, and only around it: anything left
  # unset would be filled by Prisma or dotenv from backend/.env, production.
  if ($Migrate -or $Seed) {
    if ($Seed) {
      foreach ($required in @('STAGING_PROJECT_REF', 'SEED_PASSWORD')) {
        if (-not $stagingVars[$required]) { Write-Host "ABORTED: $required is missing from backend/.env.staging."; exit 1 }
      }
    }
    $stepEnv = @{ DATABASE_URL = $stagingVars['DATABASE_URL']; DIRECT_URL = $stagingVars['DIRECT_URL'] }
    if ($Seed) { $stepEnv['STAGING_PROJECT_REF'] = $stagingVars['STAGING_PROJECT_REF']; $stepEnv['SEED_PASSWORD'] = $stagingVars['SEED_PASSWORD'] }
    Push-Location (Join-Path $PSScriptRoot 'backend')
    try {
      Invoke-WithEnv $stepEnv {
        $ErrorActionPreference = 'Continue'
        if ($Migrate) {
          # Prisma's own "Datasource ... at <host>" line is dropped, as in the
          # status check below; the migration names and result stay.
          & npx prisma migrate deploy 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'Datasource' }
        } else {
          & npm run db:seed:staging 2>&1 | ForEach-Object { "$_" }
        }
        $script:stepExitCode = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
      }
    } finally {
      Pop-Location
    }
    if ($stepExitCode -ne 0) { Write-Host "STAGING $(if ($Migrate) { 'MIGRATE' } else { 'SEED' }) FAILED (exit code $stepExitCode)."; exit $stepExitCode }
    Write-Host "Staging $(if ($Migrate) { 'migrations applied' } else { 'seeded' }). Nothing was deployed."
    exit 0
  }
} else {
  $branch = git rev-parse --abbrev-ref HEAD
  $isDirty = [bool](git status --porcelain)
  if (-not $Force -and ($isDirty -or $branch -ne 'main')) {
    Write-Host "DEPLOY ABORTED: prod deploys run from a clean checkout of main (branch: $branch, uncommitted changes: $isDirty)."
    Write-Host "Commit or stash, switch to main, or pass -Force if you really mean it."
    exit 1
  }
  if (-not $NoBackup) {
    $bk = Get-ChildItem (Join-Path $HOME 'Backups') -Filter ('vv-backup-{0}-*.sql' -f (Get-Date -Format 'yyyy-MM-dd')) -ErrorAction SilentlyContinue |
      Where-Object Length -gt 0 | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $bk) {
      Write-Host "DEPLOY ABORTED: no backup from today in $(Join-Path $HOME 'Backups'). Run .\backup.ps1 first, or pass -NoBackup if you really mean it."
      exit 1
    }
    Write-Host "Today's backup: $($bk.FullName)"
  }
  # The legal pages must match the app and name a real support address (9.2).
  $ErrorActionPreference = 'Continue'
  & node (Join-Path $PSScriptRoot 'frontend/scripts/check-legal.mjs') --release
  $legalExitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($legalExitCode -ne 0) {
    Write-Host "DEPLOY ABORTED: the legal pages check failed (see above)."
    exit 1
  }
}

if (-not $SkipMigrationCheck) {
  Write-Host "Checking migration status ($Target)..."

  # The staging variables are set only around this step; the Netlify build
  # below must see the staging SITE's env vars, not this shell's.
  $migrationEnv = @{}
  if ($Target -eq 'staging') {
    $migrationEnv = @{ DATABASE_URL = $stagingVars['DATABASE_URL']; DIRECT_URL = $stagingVars['DIRECT_URL'] }
  }

  Push-Location backend
  try {
    Invoke-WithEnv $migrationEnv {
      # Run with ErrorActionPreference Continue: under Stop, PowerShell 5.1
      # turns a native command's stderr lines into terminating NativeCommandErrors
      # when redirected with 2>&1, which would abort the script before we get to
      # inspect the exit code ourselves.
      $prevEAP = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $script:migrationOutput = & npx prisma migrate status 2>&1 | Out-String
      $script:migrationExitCode = $LASTEXITCODE
      $ErrorActionPreference = $prevEAP
    }
  } finally {
    Pop-Location
  }

  if ($migrationExitCode -ne 0) {
    # Never dump prisma's raw output — it echoes the datasource host. Pull just
    # the migration names out of the text after the "not yet applied" heading;
    # a 14-digit-prefixed token there is always a migration directory name.
    $pendingNames = @()
    $markerIndex = $migrationOutput.IndexOf('have not yet been applied')
    if ($markerIndex -ge 0) {
      $tail = $migrationOutput.Substring($markerIndex)
      $pendingNames = @([regex]::Matches($tail, '\d{14}_[A-Za-z0-9_]+') | ForEach-Object { $_.Value } | Select-Object -Unique)
    }

    if ($markerIndex -ge 0) {
      Write-Host ""
      Write-Host "DEPLOY ABORTED: $($pendingNames.Count) migration(s) have not yet been applied:"
      foreach ($name in $pendingNames) { Write-Host "  - $name" }
      Write-Host ""
      Write-Host "Apply them, then re-run deploy:"
      if ($Target -eq 'staging') {
        Write-Host "  (with backend/.env.staging loaded) cd backend; npx prisma migrate deploy"
      } else {
        Write-Host "  cd backend; npx prisma migrate deploy"
      }
      exit 1
    } else {
      Write-Host ""
      Write-Host "DEPLOY ABORTED: 'npx prisma migrate status' failed (exit code $migrationExitCode) for a reason other than pending migrations - most likely the database is unreachable."
      Write-Host "Run this manually to see full details: cd backend; npx prisma migrate status"
      exit 1
    }
  }

  Write-Host "Migrations up to date."
}

if (-not $Message) {
  $tag = (git tag --points-at HEAD | Select-Object -First 1)
  $subject = git log -1 --pretty=%s
  $short = git rev-parse --short HEAD
  $dirty = ''
  if (git status --porcelain) { $dirty = ' + uncommitted local changes' }
  if ($tag) {
    $Message = "$tag ($short): $subject$dirty"
  } else {
    $Message = "($short): $subject$dirty"
  }
}

function Find-Flyctl {
  foreach ($name in @('fly', 'flyctl')) {
    $cmd = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
  }
  $flyHome = Join-Path $HOME '.fly\bin\flyctl.exe'
  if (Test-Path -LiteralPath $flyHome) { return $flyHome }
  throw "flyctl not found: install it (https://fly.io/docs/flyctl/install/) or put fly / flyctl on PATH ($flyHome is also checked)."
}

# The API goes first: the frontend must never reach for an API that is not up.
if ($RunBackend) {
  $fly = Find-Flyctl
  Write-Host "Deploying the API to Fly ($FlyApp)..."
  Push-Location (Join-Path $PSScriptRoot 'backend')
  try {
    $ErrorActionPreference = 'Continue'
    & $fly deploy -c "fly.$Target.toml" --ha=false
    $flyExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
  } finally {
    Pop-Location
  }
  if ($flyExitCode -ne 0) {
    Write-Host ""
    Write-Host "DEPLOY ABORTED: fly deploy failed (exit code $flyExitCode). The frontend was not deployed."
    exit $flyExitCode
  }
  $healthUrl = "https://$FlyApp.fly.dev/health/live"
  $healthy = $false
  foreach ($attempt in 1..12) {
    try {
      $healthy = (Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200
    } catch { $healthy = $false }
    if ($healthy) { break }
    Start-Sleep -Seconds 5
  }
  if (-not $healthy) {
    Write-Host "DEPLOY ABORTED: $healthUrl did not return 200 within about 60 s. The frontend was not deployed."
    exit 1
  }
  Write-Host "API is live: $healthUrl returned 200."
}

$netlifyArgs = @('netlify-cli@26.2.0', 'deploy', '--build', '--message', "$Message")
if ($Draft) {
  # Netlify caps an alias at 37 characters; 'rehearse-' plus a short sha fits.
  $draftAlias = if ($Alias) { $Alias } else { 'rehearse-' + (git rev-parse --short HEAD) }
  $netlifyArgs += @('--alias', $draftAlias)
} else {
  $netlifyArgs += '--prod'
}
# --prod publishes to the site's production URL; --site always names the site,
# so a stale local .netlify link can't publish prod code to another site while
# the smoke check passes against the unchanged prod URL.
if ($Target -eq 'staging') {
  $netlifyArgs += @('--site', $stagingVars['NETLIFY_STAGING_SITE_ID'])
} else {
  $netlifyArgs += @('--site', $ProdSiteId)
}

# Read by netlify/plugins/api-proxy at build time, which fails the build on any
# other value. Not secret, so it is logged. Cleared again after the deploy.
if ($ApiOrigin -eq 'function') {
  $env:API_ORIGIN = 'function'
} else {
  $env:API_ORIGIN = "https://$FlyApp.fly.dev"
}
Write-Host "API_ORIGIN=$($env:API_ORIGIN)"

if ($RunFrontend) {
  Write-Host "Deploying to $Target$(if ($Draft) { ' (draft)' }) with message: $Message"
  # Same PowerShell 5.1 trap as the migration check above: under Stop, npm's
  # harmless stderr warnings (e.g. "npm warn allow-scripts") become terminating
  # NativeCommandErrors and abort the deploy before it starts. Run with Continue
  # and judge success by the CLI's exit code instead.
  $ErrorActionPreference = 'Continue'
  & npx @netlifyArgs
  $deployExitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  Remove-Item Env:API_ORIGIN -ErrorAction SilentlyContinue -WhatIf:$false
  if ($deployExitCode -ne 0) {
    Write-Host ""
    Write-Host "DEPLOY FAILED (exit code $deployExitCode). Check the output above for whether anything was published."
    exit $deployExitCode
  }
}

Write-Host ""
Write-Host "Running the smoke check against $Target..."
if ($Target -eq 'staging') {
  $smokeEnv = @{}
  foreach ($key in $stagingVars.Keys) {
    if ($key.StartsWith('SMOKE_')) { $smokeEnv[$key] = $stagingVars[$key] }
  }
  $smokeUrl = $stagingVars['STAGING_URL']
  if ($Draft -and $RunFrontend) {
    # https://<alias>--<site-name>.netlify.app, derived from STAGING_URL's host.
    $siteHost = ([System.Uri]$stagingVars['STAGING_URL']).Host
    $smokeUrl = "https://$draftAlias--$siteHost"
    Write-Host "Draft URL: $smokeUrl"
  }
} else {
  # Prod runs only the read-only checks: blank any SMOKE_* left in this shell.
  $smokeEnv = @{ SMOKE_EMAIL = $null; SMOKE_PASSWORD = $null; SMOKE_OUTSIDER_EMAIL = $null; SMOKE_OUTSIDER_PASSWORD = $null }
  $smokeUrl = $ProdUrl
}
Invoke-WithEnv $smokeEnv {
  $ErrorActionPreference = 'Continue'
  & node (Join-Path $PSScriptRoot 'backend/scripts/smoke.mjs') $smokeUrl
  $script:smokeExitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
}
if ($smokeExitCode -ne 0) {
  Write-Host ""
  Write-Host "DEPLOYED, BUT THE SMOKE CHECK FAILED (exit code $smokeExitCode). The new version is live on $Target - check it now."
  exit $smokeExitCode
}
