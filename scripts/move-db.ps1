# Moves the database between Supabase projects (9.6.R5). Supabase can't change a
# project's region in place, and the Free org allows only two ACTIVE projects, so
# each environment moves by: export from the old project -> pause it -> create
# the new project in Sydney -> import from the local files. See
# docs/region-move-runbook.md for the whole sequence; run backup.ps1 first as
# the safety copy.
#
#   $env:OLD_DB_URL = '<old project, Supabase > Connect > Session pooler>'
#   .\scripts\move-db.ps1 -Export -From <oldref> -Out D:\vv-move-staging
#
#   $env:NEW_DB_URL = '<new project, Session pooler>'
#   .\scripts\move-db.ps1 -Import -To <newref> -In D:\vv-move-staging
#
# Both modes make you type the project ref before touching anything. For
# non-interactive runs pass -ConfirmRef <ref> or set $env:MOVE_CONFIRM_REF.
#
# Export writes data.dump (pg_dump custom format, data only: pg_restore can't
# read backup.ps1's plain .sql), migrations.json (the old _prisma_migrations
# rows) and counts.json (rows per public table). The folder holds every user's
# data (players can be minors), so it must be outside the repo.
#
# Import runs prisma migrate deploy for the schema (which also re-applies the
# RLS and revoke-grants migrations), restores the data, then verifies: row
# counts, migrations history, RLS, grants, sequences. Exit 1 on any FAIL.
#
# No superuser on Supabase, so no --disable-triggers: pg_restore --data-only
# loads tables in the dump's dependency order with FK checks on.
# Home networks are often IPv4-only and Supabase's direct host is IPv6-only, so
# use the Session pooler URL (port 5432; 6543 is rewritten to 5432 because the
# transaction pooler can't run pg_dump). URLs are never printed: they reach
# Docker through the environment (-e DBURL) and every output line is scrubbed.
param(
  [switch]$Export,
  [switch]$Import,
  [string]$From,
  [string]$To,
  [string]$Out,
  [string]$In,
  [string]$ConfirmRef = $env:MOVE_CONFIRM_REF
)

$ErrorActionPreference = 'Stop'
$Docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
# The Singapore projects. Never import into them, never import from a URL naming them.
$OldRefs = @('rkkhrmhorgdqkxflipui', 'lnzircweyhwiemspuaav')
$repo = Split-Path -Parent $PSScriptRoot
$secrets = @()   # strings scrubbed from any output

function Hide([string]$Text) {
  foreach ($s in $secrets) { if ($s) { $Text = $Text.Replace($s, '<redacted>') } }
  $Text
}
function Fail([string]$Msg) { Write-Host "REFUSED: $Msg" -ForegroundColor Red; exit 1 }

# libpq-safe URL (no Prisma query options, session pooler, SSL for Supabase).
function ConvertTo-PgUrl([string]$Url) {
  # A malformed URL makes the cast throw an error quoting the whole value.
  try { $uri = [System.Uri]$Url } catch { return $null }
  $port = if ($uri.Port -eq 6543) { 5432 } else { $uri.Port }
  $ssl = if ($uri.Host -like '*.supabase.com' -or $uri.Host -like '*.supabase.co') { '?sslmode=require' } else { '' }
  '{0}://{1}@{2}:{3}{4}{5}' -f $uri.Scheme, $uri.UserInfo, $uri.Host, $port, $uri.AbsolutePath, $ssl
}
# Inside the container, localhost is the container itself, not Karlos's machine.
function ConvertTo-ContainerUrl([string]$Url) {
  $Url -replace '@(127\.0\.0\.1|localhost|\[::1\]):', '@host.docker.internal:'
}
function Test-LocalUrl([string]$Url) { $Url -match '@(127\.0\.0\.1|localhost|\[::1\]):' }

# Runs sh -c $Script in a postgres:17 container with $env:DBURL set; optional
# SQL on stdin and a host folder mounted at /data.
function Invoke-Pg([string]$ContainerUrl, [string]$Script, [string]$Sql, [string]$Mount) {
  $dockerArgs = @('run', '--rm', '-e', 'DBURL', '--add-host=host.docker.internal:host-gateway')
  if ($Sql) { $dockerArgs += '-i' }
  if ($Mount) { $dockerArgs += @('-v', "${Mount}:/data") }
  $dockerArgs += @('postgres:17', 'sh', '-c', $Script)
  try {
    $env:DBURL = $ContainerUrl
    if ($Sql) { $res = $Sql | & $Docker @dockerArgs } else { $res = & $Docker @dockerArgs }
  } finally { Remove-Item Env:DBURL -ErrorAction SilentlyContinue -WhatIf:$false }
  if ($LASTEXITCODE -ne 0) { throw "docker/postgres command failed (exit $LASTEXITCODE)" }
  ($res | Out-String).Trim()
}
function Invoke-Sql([string]$ContainerUrl, [string]$Sql) {
  Invoke-Pg $ContainerUrl 'psql "$DBURL" -At -v ON_ERROR_STOP=1' $Sql
}

# Counts every public table except _prisma_migrations (rebuilt by migrate
# deploy). query_to_xml needs no superuser, unlike a COPY or a pg_stat shortcut.
$CountsSql = @"
select coalesce(json_object_agg(table_name, c order by table_name), '{}'::json) from (
  select table_name::text,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as c
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '_prisma_migrations'
) t;
"@
$MigrationsSql = "select coalesce(json_agg(json_build_object('id', id, 'migration_name', migration_name, 'finished_at', finished_at, 'applied_steps_count', applied_steps_count) order by migration_name), '[]'::json) from _prisma_migrations;"

function Confirm-Ref([string]$Ref, [string]$What) {
  $typed = $ConfirmRef
  if (-not $typed) { $typed = Read-Host "Type the project ref ($Ref) to confirm $What" }
  if ($typed -cne $Ref) { Fail "the typed ref doesn't match $Ref." }
}

function Assert-UrlMatchesRef([string]$Url, [string]$Ref, [string]$Var) {
  # A local URL (the rehearsal against Docker) carries no ref; a remote one must name the project typed.
  if (-not (Test-LocalUrl $Url) -and -not $Url.Contains($Ref)) { Fail "${Var} doesn't contain the ref ${Ref}: wrong project?" }
}

if ($Export -eq $Import) { Fail 'give exactly one of -Export or -Import.' }

# ---------------------------------------------------------------- Export
if ($Export) {
  if (-not $From -or -not $Out) { Fail '-Export needs -From <ref> and -Out <folder>.' }
  if (-not $env:OLD_DB_URL) { Fail 'OLD_DB_URL is not set.' }
  $secrets = @($env:OLD_DB_URL)
  try {
    Assert-UrlMatchesRef $env:OLD_DB_URL $From 'OLD_DB_URL'
    Confirm-Ref $From 'exporting from it'
    $Out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
    $sep = [System.IO.Path]::DirectorySeparatorChar
    $repoFull = [System.IO.Path]::GetFullPath($repo).TrimEnd($sep) + $sep
    if (([System.IO.Path]::GetFullPath($Out).TrimEnd($sep) + $sep).StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      Fail "$Out is inside the repo: the export holds everyone's data in plain text. Pick a folder outside it."
    }
    $url = ConvertTo-PgUrl $env:OLD_DB_URL
    if (-not $url) { Fail 'OLD_DB_URL is not a valid URL (check for unencoded special characters in the password).' }
    $secrets += $url
    $cUrl = ConvertTo-ContainerUrl $url
    & $Docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop and try again.' }

    New-Item -ItemType Directory -Force -Path $Out -WhatIf:$false | Out-Null
    $rows = @()
    try {
      Write-Host 'Exporting data.dump ...'
      Invoke-Pg $cUrl 'pg_dump "$DBURL" -Fc --data-only --schema=public --exclude-table=_prisma_migrations --no-owner -f /data/data.dump' $null $Out | Out-Null
      $size = (Get-Item -LiteralPath (Join-Path $Out 'data.dump')).Length
      $rows += [pscustomobject]@{ Check = 'data.dump written'; Result = if ($size -gt 0) { 'PASS' } else { 'FAIL' }; Note = "$([math]::Round($size / 1KB)) KB" }

      $counts = Invoke-Sql $cUrl $CountsSql
      $migs = Invoke-Sql $cUrl $MigrationsSql
      # Written without a BOM: PowerShell 5.1's Set-Content -Encoding utf8 adds one, which Node's JSON.parse rejects.
      [System.IO.File]::WriteAllText((Join-Path $Out 'counts.json'), $counts)
      [System.IO.File]::WriteAllText((Join-Path $Out 'migrations.json'), $migs)
      $c = $counts | ConvertFrom-Json
      $total = ($c.PSObject.Properties | Measure-Object -Property Value -Sum).Sum
      $nTables = ($c.PSObject.Properties | Measure-Object).Count
      $nMigs = @($migs | ConvertFrom-Json | ForEach-Object { $_ }).Count
      $rows += [pscustomobject]@{ Check = 'counts.json'; Result = if ($nTables -gt 0) { 'PASS' } else { 'FAIL' }; Note = "$nTables tables, $total rows" }
      $rows += [pscustomobject]@{ Check = 'migrations.json'; Result = if ($nMigs -gt 0) { 'PASS' } else { 'FAIL' }; Note = "$nMigs migrations" }
    } catch {
      $rows += [pscustomobject]@{ Check = 'export'; Result = 'FAIL'; Note = (Hide $_.Exception.Message) }
    }
    $rows | Format-Table -AutoSize | Out-String | Write-Host
    if ($rows | Where-Object Result -eq 'FAIL') { Write-Host 'EXPORT FAILED.' -ForegroundColor Red; exit 1 }
    Write-Host "Export saved to $Out. It holds everyone's data: keep it private, delete it after the 7-day fallback." -ForegroundColor Green
    exit 0
  } finally {
    Remove-Item Env:OLD_DB_URL -ErrorAction SilentlyContinue -WhatIf:$false
  }
}

# ---------------------------------------------------------------- Import
if (-not $To -or -not $In) { Fail '-Import needs -To <ref> and -In <folder>.' }
if (-not $env:NEW_DB_URL) { Fail 'NEW_DB_URL is not set.' }
$secrets = @($env:NEW_DB_URL)
try {
  foreach ($old in $OldRefs) {
    if ($To -eq $old) { Fail "-To $old is an old Singapore project: never import into it." }
    if ($env:NEW_DB_URL.Contains($old)) { Fail "NEW_DB_URL names the old project ${old}: never import into it." }
  }
  Assert-UrlMatchesRef $env:NEW_DB_URL $To 'NEW_DB_URL'
  Confirm-Ref $To 'importing into it'
  $In = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($In)
  foreach ($f in 'data.dump', 'counts.json', 'migrations.json') {
    if (-not (Test-Path -LiteralPath (Join-Path $In $f))) { Fail "${In} has no ${f}: run -Export first." }
  }
  $url = ConvertTo-PgUrl $env:NEW_DB_URL
  if (-not $url) { Fail 'NEW_DB_URL is not a valid URL (check for unencoded special characters in the password).' }
  $secrets += $url
  $cUrl = ConvertTo-ContainerUrl $url
  & $Docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop and try again.' }

  $rows = @()
  function Add-Row([string]$Check, [bool]$Ok, [string]$Note) {
    $script:rows += [pscustomobject]@{ Check = $Check; Result = if ($Ok) { 'PASS' } else { 'FAIL' }; Note = $Note }
  }

  try {
    # 1. Schema. migrate deploy only applies; it never drops or resets.
    Write-Host '1/3 prisma migrate deploy ...'
    $saved = @{ DATABASE_URL = $env:DATABASE_URL; DIRECT_URL = $env:DIRECT_URL }
    Push-Location (Join-Path $repo 'backend')
    try {
      $env:DATABASE_URL = $url; $env:DIRECT_URL = $url
      $prismaOut = & npx prisma migrate deploy | Out-String
      $prismaExit = $LASTEXITCODE
    } finally {
      Pop-Location
      foreach ($k in $saved.Keys) { if ($null -eq $saved[$k]) { Remove-Item "Env:$k" -ErrorAction SilentlyContinue -WhatIf:$false } else { Set-Item "Env:$k" $saved[$k] } }
    }
    Add-Row 'prisma migrate deploy' ($prismaExit -eq 0) $(if ($prismaExit -eq 0) { 'schema applied' } else { (Hide $prismaOut).Trim() })
    if ($prismaExit -ne 0) { throw 'schema step failed' }

    # 2. Data. The target must be empty: a half-filled one would fail on duplicate keys.
    Write-Host '2/3 pg_restore ...'
    $nonEmpty = Invoke-Sql $cUrl ($CountsSql -replace 'select coalesce\(json_object_agg\(table_name, c order by table_name\), ''\{\}''::json\) from', 'select coalesce(sum(c), 0) from')
    Add-Row 'target is empty before restore' ([int64]$nonEmpty -eq 0) "$nonEmpty rows"
    if ([int64]$nonEmpty -ne 0) { throw 'target already holds data' }
    Invoke-Pg $cUrl 'pg_restore --data-only --no-owner --exit-on-error -d "$DBURL" /data/data.dump' $null "$In" | Out-Null
    Add-Row 'pg_restore' $true 'data restored'

    # 3. Verify.
    Write-Host '3/3 verifying ...'
    $want = Get-Content -Raw -LiteralPath (Join-Path $In 'counts.json') | ConvertFrom-Json
    $got = Invoke-Sql $cUrl $CountsSql | ConvertFrom-Json
    $bad = @()
    foreach ($p in $want.PSObject.Properties) {
      if ($null -eq $got.($p.Name) -or [int64]$got.($p.Name) -ne [int64]$p.Value) { $bad += "$($p.Name): want $($p.Value), got $($got.($p.Name))" }
    }
    foreach ($p in $got.PSObject.Properties) { if ($null -eq $want.($p.Name)) { $bad += "$($p.Name): not in the export" } }
    $total = ($want.PSObject.Properties | Measure-Object -Property Value -Sum).Sum
    Add-Row 'row counts match' ($bad.Count -eq 0) $(if ($bad) { $bad -join '; ' } else { "$(($want.PSObject.Properties | Measure-Object).Count) tables, $total rows" })

    # The old history must be a prefix of the new one; the extras must be exactly the migrations added since.
    $oldNames = @((Get-Content -Raw -LiteralPath (Join-Path $In 'migrations.json') | ConvertFrom-Json) | ForEach-Object { $_.migration_name } | Sort-Object)
    $newRows = @(Invoke-Sql $cUrl $MigrationsSql | ConvertFrom-Json | ForEach-Object { $_ })
    $newNames = @($newRows | ForEach-Object { $_.migration_name } | Sort-Object)
    $dirs = @(Get-ChildItem -LiteralPath (Join-Path $repo 'backend\prisma\migrations') -Directory | ForEach-Object { $_.Name } | Sort-Object)
    $expectExtra = @($dirs | Where-Object { $oldNames -cnotcontains $_ })
    $prefixOk = $newNames.Count -ge $oldNames.Count -and (-not (Compare-Object $oldNames ($newNames | Select-Object -First $oldNames.Count) -CaseSensitive))
    $extra = @($newNames | Select-Object -Skip $oldNames.Count)
    $extraOk = -not (Compare-Object @($extra) @($expectExtra) -CaseSensitive)
    $unfinished = @($newRows | Where-Object { -not $_.finished_at }).Count
    Add-Row 'old migrations are a prefix of the new' $prefixOk "$($oldNames.Count) old, $($newNames.Count) new"
    Add-Row 'extra migrations = those added since export' ($extraOk -and $unfinished -eq 0) $(if ($extra) { $extra -join ', ' } else { '(none)' })

    $noRls = Invoke-Sql $cUrl "select coalesce(string_agg(tablename, ', '), '') from pg_tables where schemaname = 'public' and not rowsecurity;"
    Add-Row 'RLS on for every public table' ($noRls -eq '') $(if ($noRls) { "without RLS: $noRls" } else { 'all on' })
    $roles = [int64](Invoke-Sql $cUrl "select count(*) from pg_roles where rolname in ('anon','authenticated');")
    if ($roles -eq 0) {
      Add-Row 'no anon/authenticated grants' $true 'roles absent (plain Postgres): nothing to check'
    } else {
      $grants = [int64](Invoke-Sql $cUrl "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated');")
      Add-Row 'no anon/authenticated grants' ($grants -eq 0) "$grants grants"
    }
    $seq = [int64](Invoke-Sql $cUrl "select count(*) from information_schema.sequences where sequence_schema = 'public';")
    Add-Row 'no sequences in use (ids are cuids)' ($seq -eq 0) "$seq sequences"
  } catch {
    Add-Row 'import' $false (Hide $_.Exception.Message)
  }
  $rows | Format-Table -AutoSize -Wrap | Out-String | Write-Host
  if ($rows | Where-Object Result -eq 'FAIL') { Write-Host 'IMPORT FAILED OR NOT VERIFIED. Do not reopen the app.' -ForegroundColor Red; exit 1 }
  Write-Host 'Import verified.' -ForegroundColor Green
  exit 0
} finally {
  Remove-Item Env:NEW_DB_URL -ErrorAction SilentlyContinue -WhatIf:$false
}
