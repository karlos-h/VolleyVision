# Proves deploy.ps1's parameter rules without ever reaching a real deploy: each
# refusal case runs deploy.ps1 in a child process and must fail on the
# parameter check alone, before any git, network or CLI call (so it needs no
# .env file, Fly or Netlify login). Static checks pin the Fly step's shape.
#   powershell -NoProfile -File deploy.test.ps1   (or pwsh)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'deploy.ps1'
$errs = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$null, [ref]$errs)

$failures = 0
function Check([bool]$ok, [string]$what) {
  if ($ok) { Write-Host "  ok   $what" } else { Write-Host "  FAIL $what" -ForegroundColor Red; $script:failures++ }
}

Write-Host 'static'
Check ($errs.Count -eq 0) 'deploy.ps1 has no parse errors'
$params = @{}
foreach ($p in $ast.ParamBlock.Parameters) { $params[$p.Name.VariablePath.UserPath] = $p }
Check ($null -eq $params['Target'].DefaultValue) '-Target has no default'
Check (-not ($params['Target'].Attributes | Where-Object { $_.TypeName.Name -eq 'Parameter' })) '-Target is a plain parameter (no prompt); the body throws instead'
foreach ($n in 'BackendOnly', 'FrontendOnly', 'Draft') { Check ($params[$n].StaticType -eq [switch]) "-$n is a switch" }
Check ($params.ContainsKey('Alias')) '-Alias exists'
$text = Get-Content -LiteralPath $script -Raw
Check ($text -match 'deploy -c "fly\.\$Target\.toml" --ha=false') 'runs fly deploy -c fly.<target>.toml --ha=false'
Check ($text -match '/health/live') 'checks /health/live'
Check ($text.IndexOf('& $fly deploy') -lt $text.IndexOf('& npx @netlifyArgs')) 'the Fly deploy comes before the Netlify deploy'
$firstExternal = [regex]::Match($text, '\bgit (rev-parse|status|tag|log)\b|Test-Path|Read-EnvFile \$').Index
$lastThrow = [regex]::Matches($text, 'throw "-(Target|BackendOnly|Alias|ApiOrigin)').Index | Measure-Object -Maximum | ForEach-Object Maximum
Check ($lastThrow -lt $firstExternal) 'every parameter refusal sits before the first git / file / network call'

# Each case: refused (non-zero), with the expected message, and without ever
# getting as far as a deploy or a git/CLI step.
function Invoke-Deploy([string[]]$Arguments) {
  $ErrorActionPreference = 'Continue'   # the child's error text arrives on stderr
  $out = & (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1 | Out-String
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  [pscustomobject]@{ Code = $code; Out = $out }
}
function Refused([string[]]$Arguments, [string]$Pattern, [string]$What) {
  $r = Invoke-Deploy $Arguments
  Check ($r.Code -ne 0 -and $r.Out -match $Pattern -and $r.Out -notmatch 'Deploying|Checking migration|API_ORIGIN=|Today') $What
}

Write-Host 'refusals'
Refused @() '-Target' 'no -Target is refused'
Refused @('-Target', 'prod', '-BackendOnly', '-FrontendOnly', '-ApiOrigin', 'fly') 'mutually exclusive' '-BackendOnly -FrontendOnly is refused'
Refused @('-Target', 'prod', '-BackendOnly', '-ApiOrigin', 'function') 'BackendOnly' '-BackendOnly -ApiOrigin function is refused'
Refused @('-Target', 'prod') 'ApiOrigin' '-Target prod without -ApiOrigin is refused'
Refused @('-Target', 'staging', '-Draft', '-Alias', 'Bad_Alias') 'Alias' 'a bad -Alias is refused'
Refused @('-Target', 'staging', '-Draft', '-Alias', ('a' * 38)) 'Alias' 'a 38-character -Alias is refused'
Refused @('-Target', 'staging', '-Alias', 'rehearse') 'Alias' '-Alias without -Draft is refused'

if ($failures) { Write-Host "deploy.test.ps1: $failures FAILED" -ForegroundColor Red; exit 1 }
Write-Host 'deploy.test.ps1 passed' -ForegroundColor Green
# Explicit, as in backup.test.ps1: the last child run leaves $LASTEXITCODE = 1.
exit 0
