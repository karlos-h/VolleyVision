# Checks scripts/move-db.ps1's guard rails without any database: the AST/regex
# checks (backup.test.ps1 style) and the refusal cases, driven as child
# processes with fake URLs. Every refusal happens before Docker is touched.
#   powershell -NoProfile -File scripts\move-db.test.ps1   (or pwsh)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'move-db.ps1'
$text = Get-Content -Raw -LiteralPath $script
$ast = [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$null, [ref]$null)
$prod = 'rkkhrmhorgdqkxflipui'
$stg = 'lnzircweyhwiemspuaav'

$failures = 0
function Check([bool]$ok, [string]$what) {
  if ($ok) { Write-Host "  ok   $what" } else { Write-Host "  FAIL $what" -ForegroundColor Red; $script:failures++ }
}

Write-Host 'static checks'
# Under -WhatIf, Remove-Item would skip clearing the connection string.
$envRemovals = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -eq 'Remove-Item' -and $n.Extent.Text -match 'Env:' }, $true)
foreach ($v in 'OLD_DB_URL', 'NEW_DB_URL') {
  Check (@($envRemovals | Where-Object { $_.Extent.Text -match $v }).Count -gt 0) "$v is cleared in a finally"
}
foreach ($c in $envRemovals) { Check ($c.Extent.Text -match '-WhatIf:\$false') "Remove-Item Env: carries -WhatIf:`$false: $($c.Extent.Text)" }
Check ($text.Contains($prod) -and $text.Contains($stg)) 'both old refs are in the refusal list'
Check (-not ($text -split "`n" | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '--disable-triggers' })) '--disable-triggers is absent (needs superuser)'
# Anything printed (Write-Host/Write-Output/echo/Fail) must not interpolate or pass a URL variable.
$printers = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -in 'Write-Host', 'Write-Output', 'Write-Warning', 'Write-Error', 'Fail' }, $true)
$leaks = @($printers | Where-Object { $_.Extent.Text -match '\$env:(OLD|NEW)_DB_URL|\$url\b|\$cUrl\b' })
Check ($leaks.Count -eq 0) 'no print statement mentions a URL variable'
Check ($null -ne $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-EnvValue' }, $true)) 'Read-EnvValue is defined (-EnvFile)'
# The env-file reader must never print what it reads (or the path's contents).
$readers = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -in 'Read-EnvValue', 'Get-UrlFromEnvFile' }, $true)
foreach ($fn in $readers) {
  $prints = $fn.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -match '^(Write-|Out-Host|echo)' }, $true)
  Check ($prints.Count -eq 0) "$($fn.Name) has no Write-*"
}
$envPrints = @($printers | Where-Object { $_.Extent.Text -match '\$EnvFile|\$Matches|\$v\b' })
Check ($envPrints.Count -eq 0) 'no print statement mentions the env file or a value read from it'


# Local-client path: the URL travels in PG* env vars, which must be cleared even under -WhatIf
# (Remove-Item Env: above), and never printed.
Write-Host 'PG* env cleanup'
$clear = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Clear-PgEnv' }, $true)
Check ($null -ne $clear -and $clear.Extent.Text -match 'PGPASSWORD' -and $clear.Extent.Text -match "-WhatIf:\`$false") 'Clear-PgEnv clears PGPASSWORD with -WhatIf:$false'
$setters = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.TryStatementAst] -and $n.Body.Extent.Text -match '\bSet-PgEnv\b' }, $true)
Check ($setters.Count -gt 0) 'Set-PgEnv is called inside a try'
foreach ($t in $setters) { Check ($null -ne $t.Finally -and $t.Finally.Extent.Text -match '\bClear-PgEnv\b') 'that try has a finally calling Clear-PgEnv' }
$pgPrints = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -match '^(Write-|Out-Host|echo|Fail$)' -and $n.Extent.Text -match 'PG(PASSWORD|USER|HOST|DATABASE)' }, $true)
Check (@($pgPrints).Count -eq 0) 'no print statement mentions a PG* variable'

Write-Host 'refusals'
$ps = (Get-Process -Id $PID).Path
$td = Join-Path ([System.IO.Path]::GetTempPath()) ('vv-move-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $td | Out-Null
foreach ($f in 'data.dump', 'counts.json', 'migrations.json') { Set-Content -LiteralPath (Join-Path $td $f) -Value 'x' }
$fakeNew = 'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
function Run([hashtable]$envVars, [string[]]$scriptArgs) {
  $saved = @{}
  foreach ($k in 'OLD_DB_URL', 'NEW_DB_URL', 'MOVE_CONFIRM_REF') { $saved[$k] = [Environment]::GetEnvironmentVariable($k) ; [Environment]::SetEnvironmentVariable($k, $null) }
  foreach ($k in $envVars.Keys) { [Environment]::SetEnvironmentVariable($k, $envVars[$k]) }
  try {
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $o = & $ps -NoProfile -File $script @scriptArgs 2>&1 | Out-String
    [pscustomobject]@{ Exit = $LASTEXITCODE; Out = $o }
  } finally {
    $ErrorActionPreference = $prev
    foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) }
  }
}
function Refused($r, [string]$what, [string]$pattern) {
  Check ($r.Exit -eq 1 -and $r.Out -match $pattern) $what
  Check ($r.Out -notmatch 'postgres(ql)?://') "  (and prints no URL) $what"
}

try {
  Refused (Run @{} @('-Export', '-From', 'abc', '-Out', $td)) 'export without OLD_DB_URL' 'OLD_DB_URL is not set'
  Refused (Run @{} @('-Import', '-To', 'abc', '-In', $td)) 'import without NEW_DB_URL' 'NEW_DB_URL is not set'
  Refused (Run @{ NEW_DB_URL = $fakeNew } @('-Import', '-To', $prod, '-In', $td)) 'import with -To = prod ref' 'old Singapore project'
  Refused (Run @{ NEW_DB_URL = $fakeNew } @('-Import', '-To', $stg, '-In', $td)) 'import with -To = staging ref' 'old Singapore project'
  Refused (Run @{ NEW_DB_URL = "postgresql://postgres.${prod}:pw@host:5432/postgres" } @('-Import', '-To', 'abcdefghijklmnopqrst', '-In', $td)) 'NEW_DB_URL containing the prod ref' 'names the old project'
  Refused (Run @{ NEW_DB_URL = "postgresql://postgres:pw@db.${stg}.supabase.co:5432/postgres" } @('-Import', '-To', 'abcdefghijklmnopqrst', '-In', $td)) 'NEW_DB_URL containing the staging ref' 'names the old project'
  Refused (Run @{ NEW_DB_URL = $fakeNew; MOVE_CONFIRM_REF = 'wrong' } @('-Import', '-To', 'abcdefghijklmnopqrst', '-In', $td)) 'import with a wrong typed ref' "typed ref doesn't match"
  Refused (Run @{ NEW_DB_URL = $fakeNew } @('-Import', '-To', 'zzzzzzzzzzzzzzzzzzzz', '-In', $td, '-ConfirmRef', 'zzzzzzzzzzzzzzzzzzzz')) 'import where the URL is not the typed project' "doesn't contain the ref"
  Refused (Run @{ OLD_DB_URL = $fakeNew; MOVE_CONFIRM_REF = 'wrong' } @('-Export', '-From', 'abcdefghijklmnopqrst', '-Out', $td)) 'export with a wrong typed ref' "typed ref doesn't match"
  Refused (Run @{ OLD_DB_URL = $fakeNew; MOVE_CONFIRM_REF = 'abcdefghijklmnopqrst' } @('-Export', '-From', 'abcdefghijklmnopqrst', '-Out', (Join-Path $PSScriptRoot 'out'))) 'export into the repo' 'inside the repo'
  Refused (Run @{} @('-Export', '-Import')) 'both modes at once' 'exactly one'

  # -EnvFile supplies OLD_DB_URL: the run must get past "OLD_DB_URL is not set". The URL is local,
  # so it may go on to Docker/pg_dump and fail there; only the missing-env refusal and any URL echo are asserted.
  $envFile = Join-Path $td 'fake.env'
  Set-Content -LiteralPath $envFile -Value 'DIRECT_URL="postgresql://u:p@localhost:5/x"'
  $outDir = Join-Path $td 'out'
  $r = Run @{} @('-Export', '-From', $stg, '-Out', $outDir, '-EnvFile', $envFile, '-ConfirmRef', $stg)
  Check ($r.Out -notmatch 'OLD_DB_URL is not set') '-EnvFile supplies OLD_DB_URL (no missing-env refusal)'
  # Not just 'postgres': the script's own "docker/postgres command failed" message legitimately says it.
  Check ($r.Out -notmatch 'postgres(ql)?://|u:p@') '-EnvFile run prints no connection string'
  $r = Run @{} @('-Export', '-From', $stg, '-Out', $outDir, '-EnvFile', (Join-Path $td 'nope.env'), '-ConfirmRef', $stg)
  Check ($r.Exit -eq 1 -and $r.Out -match 'does not exist') 'missing -EnvFile is refused'
  # Import: a file naming an old project is still refused by the old-ref guard.
  $oldEnv = Join-Path $td 'old.env'
  Set-Content -LiteralPath $oldEnv -Value "DATABASE_URL=postgresql://postgres.${prod}:pw@host:5432/postgres"
  Refused (Run @{} @('-Import', '-To', 'abcdefghijklmnopqrst', '-In', $td, '-EnvFile', $oldEnv)) 'import with an -EnvFile naming the old project' 'names the old project'
  # A bad -PgBin is refused (before any client runs), naming the folder and no URL.
  Refused (Run @{ OLD_DB_URL = $fakeNew } @('-Export', '-From', 'abcdefghijklmnopqrst', '-Out', $td, '-ConfirmRef', 'abcdefghijklmnopqrst', '-PgBin', (Join-Path $td 'nope'))) 'export with a nonexistent -PgBin' 'PgBin .* has no pg_dump\.exe'
  Refused (Run @{ NEW_DB_URL = $fakeNew } @('-Import', '-To', 'abcdefghijklmnopqrst', '-In', $td, '-ConfirmRef', 'abcdefghijklmnopqrst', '-PgBin', (Join-Path $td 'nope'))) 'import with a nonexistent -PgBin' 'PgBin .* has no pg_dump\.exe'
} finally {
  Remove-Item -LiteralPath $td -Recurse -Force
}

if ($failures) { Write-Host "move-db.test.ps1: $failures FAILED" -ForegroundColor Red; exit 1 }
Write-Host 'move-db.test.ps1 passed' -ForegroundColor Green
exit 0
