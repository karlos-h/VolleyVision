# Proves backup.ps1's pruning deletes only what the privacy policy says it may:
# its own vv-backup-yyyy-MM-dd-HHmm.sql files, older than -KeepDays, in the
# backup folder itself, never the one just written, and nothing under -WhatIf.
# The function is lifted out of backup.ps1 so no real backup (or database) is
# needed.
#   powershell -NoProfile -File backup.test.ps1   (or pwsh)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'backup.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$null, [ref]$null)
$fn = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Remove-OldBackups' }, $true)
if (-not $fn) { throw 'backup.ps1 has no Remove-OldBackups function' }
. ([scriptblock]::Create($fn.Extent.Text))

$failures = 0
function Check([bool]$ok, [string]$what) {
  if ($ok) { Write-Host "  ok   $what" } else { Write-Host "  FAIL $what" -ForegroundColor Red; $script:failures++ }
}

$now = [datetime]'2026-10-04T12:00'
$stamp = { param($days) 'vv-backup-{0}.sql' -f $now.AddDays(-$days).ToString('yyyy-MM-dd-HHmm') }
$dir = Join-Path ([System.IO.Path]::GetTempPath()) ('vv-prune-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $dir | Out-Null
$old = & $stamp 40
$edge = & $stamp 29
$recent = & $stamp 1
$justWritten = & $stamp 400   # an odd clock must still never delete today's file
$others = @('vv-backup-2020-01-01.sql', 'vv-backup-2020-01-01-1200.sql.bak', 'notes.sql', 'VV-BACKUP-2020-01-01-1200.SQL', 'vv-backup-2020-13-45-9999.sql')
foreach ($n in @($old, $edge, $recent, $justWritten) + $others) { Set-Content -LiteralPath (Join-Path $dir $n) -Value 'x' }
New-Item -ItemType Directory -Path (Join-Path $dir 'sub') | Out-Null
Set-Content -LiteralPath (Join-Path (Join-Path $dir 'sub') $old) -Value 'x'
$present = { param($n) Test-Path -LiteralPath (Join-Path $dir $n) }

try {
  Write-Host 'Remove-OldBackups'
  Remove-OldBackups -Dir $dir -KeepDays 30 -Keep $justWritten -Now $now -WhatIf 6> $null
  Check (& $present $old) '-WhatIf deletes nothing'

  Remove-OldBackups -Dir $dir -KeepDays 30 -Keep $justWritten -Now $now 6> $null
  Check (-not (& $present $old)) 'a backup older than KeepDays is deleted'
  Check (& $present $edge) 'a backup inside KeepDays stays'
  Check (& $present $recent) "yesterday's backup stays"
  Check (& $present $justWritten) 'the file just written stays, whatever its name says'
  foreach ($n in $others) { Check (& $present $n) "a file not named like a backup stays: $n" }
  Check (Test-Path -LiteralPath (Join-Path (Join-Path $dir 'sub') $old)) 'nothing below the backup folder is touched'

  # The range check stops a bad value before backup.ps1 reads the env file or runs Docker.
  $ErrorActionPreference = 'Continue'   # the child's error text arrives on stderr
  $out = & (Get-Process -Id $PID).Path -NoProfile -File $script -KeepDays 0 -EnvFile (Join-Path $dir 'missing.env') 2>&1 | Out-String
  $ErrorActionPreference = 'Stop'
  Check ($out -match 'KeepDays' -and $out -notmatch "Can't find") '-KeepDays 0 is refused before anything runs'
} finally {
  Remove-Item -LiteralPath $dir -Recurse -Force
}

if ($failures) { Write-Host "backup.test.ps1: $failures FAILED" -ForegroundColor Red; exit 1 }
Write-Host 'backup.test.ps1 passed' -ForegroundColor Green
