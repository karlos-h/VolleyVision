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
} finally {
  Remove-Item -LiteralPath $td -Recurse -Force
}

if ($failures) { Write-Host "move-db.test.ps1: $failures FAILED" -ForegroundColor Red; exit 1 }
Write-Host 'move-db.test.ps1 passed' -ForegroundColor Green
exit 0
