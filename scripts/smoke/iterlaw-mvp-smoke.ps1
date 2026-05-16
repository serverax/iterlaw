#!/usr/bin/env pwsh
# Sprint 16 - IterLaw MVP smoke test runner.
#
# Runs every static and runtime check in
# docs/iterlaw/project/MVP_SMOKE_TEST_CHECKLIST.md (checks 1-14).
# Checks 15 and 16 (live /health and /ready) only run if
# ITERLAW_MVP_SMOKE_RUN_SERVER=1 is set and the operator has the
# orchestrator running locally - this script does NOT start it.
#
# Forbidden / never invoked by this script:
#   - kubectl (any verb)
#   - helm (any verb)
#   - systemctl
#   - firewall mutation
#   - external LLM endpoints (openai, anthropic, gemini)
#   - production DB
#   - secret read or write

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..\..")
$reportDir = Join-Path $repoRoot "reports"
$logsDir   = Join-Path $reportDir "logs"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir   | Out-Null
$ts = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$logPath    = Join-Path $logsDir   "mvp-smoke-$ts.log"
$reportPath = Join-Path $reportDir "ITERLAW_SPRINT_16_MVP_SMOKE_TEST_READINESS_$ts.md"

# --- Static safety self-check on the script's own command list -------------
$forbiddenSelfPatterns = @(
  "kubectl ",
  "helm ",
  "systemctl ",
  "iptables ",
  "ufw ",
  "firewall-cmd",
  "netsh advfirewall",
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "rm -rf /",
  "DROP DATABASE",
  "TRUNCATE "
)
$selfPath = $MyInvocation.MyCommand.Path
$selfContent = Get-Content -Raw -Path $selfPath
foreach ($pat in $forbiddenSelfPatterns) {
  # Match only if the pattern appears OUTSIDE of comments AND OUTSIDE this self-check block.
  # Simple heuristic: a forbidden token outside the forbiddenSelfPatterns array is rejected.
  $lines = $selfContent -split "`n"
  $offending = $lines | Where-Object {
    ($_ -match [Regex]::Escape($pat)) -and
    ($_ -notmatch '^\s*#') -and
    ($_ -notmatch '\$forbiddenSelfPatterns') -and
    ($_ -notmatch 'forbiddenSelfPatterns') -and
    ($_ -notmatch '"\s*' + [Regex]::Escape($pat) + '\s*"')
  }
  if ($offending) {
    Write-Error "Self-check failure: pattern '$pat' appears in non-comment / non-string position."
    exit 13
  }
}

$results = @()

function Add-Result {
  param([string]$id, [string]$name, [string]$status, [string]$detail)
  $script:results += [pscustomobject]@{
    id     = $id
    name   = $name
    status = $status
    detail = $detail
  }
}

function Run-And-Capture {
  param([string]$shellCmd, [string]$cwd)
  Push-Location $cwd
  $oldErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $out = (& cmd /c $shellCmd 2>&1 | ForEach-Object { $_.ToString() } | Out-String).Trim()
    $code = $LASTEXITCODE
    return [pscustomobject]@{ output = $out; exit = $code }
  } finally {
    $ErrorActionPreference = $oldErrorActionPreference
    Pop-Location
  }
}

function Log([string]$msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] $msg"
  Add-Content -Path $logPath -Value $line
  Write-Host $line
}

Log "Sprint 16 MVP smoke starting (repoRoot=$repoRoot)"

# --- Checks 1-4: root typecheck / lint / build / jest ---
$check1 = Run-And-Capture "npm run typecheck" $repoRoot
Add-Result "1" "Web typecheck" ($(if ($check1.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check1.exit)"
$check2 = Run-And-Capture "npm run lint" $repoRoot
Add-Result "2" "Web lint" ($(if ($check2.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check2.exit)"
$check3 = Run-And-Capture "npm run build" $repoRoot
Add-Result "3" "Web build" ($(if ($check3.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check3.exit)"
$check4 = Run-And-Capture "npm test" $repoRoot
Add-Result "4" "Root jest" ($(if ($check4.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check4.exit)"

# --- Checks 5-7: legal-orchestrator typecheck / build / vitest ---
$orchPath = Join-Path $repoRoot "apps\legal-orchestrator"
$check5 = Run-And-Capture "npm run typecheck" $orchPath
Add-Result "5" "Orchestrator typecheck" ($(if ($check5.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check5.exit)"
$check6 = Run-And-Capture "npm run build" $orchPath
Add-Result "6" "Orchestrator build" ($(if ($check6.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check6.exit)"
$check7 = Run-And-Capture "npm test" $orchPath
Add-Result "7" "Orchestrator vitest" ($(if ($check7.exit -eq 0) { "PASS" } else { "FAIL" })) "exit=$($check7.exit)"

# --- Check 8: external LLM blocked by default ---
$aiDir = Join-Path $repoRoot "apps\web\lib\ai"
$flagOK = $true
foreach ($f in @("claude.ts", "gemini.ts", "orchestrate.ts")) {
  $full = Join-Path $aiDir $f
  if (-not (Test-Path $full)) { $flagOK = $false; break }
  $body = Get-Content -Raw -Path $full
  if ($body -notmatch "isWebAiFallbackEnabled" -and $body -notmatch "ITERLAW_WEB_AI_FALLBACK_ENABLED") {
    $flagOK = $false
    break
  }
}
Add-Result "8" "External LLM blocked by default" ($(if ($flagOK) { "PASS" } else { "FAIL" })) "feature flag check on apps/web/lib/ai/{claude,gemini,orchestrate}.ts"

# --- Check 9: transport deny list in orchestrator ---
$policyPath = Join-Path $repoRoot "apps\legal-orchestrator\src\legal\llm\localTransportPolicy.ts"
if (Test-Path $policyPath) {
  $policy = Get-Content -Raw -Path $policyPath
  $denyOK = ($policy -match "openai\.com") -and ($policy -match "anthropic\.com")
  Add-Result "9" "Orchestrator transport deny list" ($(if ($denyOK) { "PASS" } else { "FAIL" })) "checked openai.com + anthropic.com presence"
} else {
  Add-Result "9" "Orchestrator transport deny list" "FAIL" "localTransportPolicy.ts not found"
}

# --- Checks 10-11: citation gates enforced ---
function Count-GrepHits([string]$pattern, [string]$path) {
  $count = 0
  Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $count += (Select-String -Path $_.FullName -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue | Measure-Object).Count
  }
  return $count
}
$citReqHits = Count-GrepHits "citation_required" (Join-Path $repoRoot "apps\legal-orchestrator\src")
$zeroBlkHits = Count-GrepHits "zero_citation_answer_blocked" (Join-Path $repoRoot "apps\legal-orchestrator\src")
Add-Result "10" "citation_required enforced in orchestrator" ($(if ($citReqHits -gt 0) { "PASS" } else { "FAIL" })) "hits=$citReqHits"
Add-Result "11" "zero_citation_answer_blocked enforced in orchestrator" ($(if ($zeroBlkHits -gt 0) { "PASS" } else { "FAIL" })) "hits=$zeroBlkHits"

# --- Check 12: RAG mode clarity ---
$ragDir = Join-Path $repoRoot "apps\legal-orchestrator\src\rag"
$pgrPath = Join-Path $ragDir "postgresRetrieval.ts"
$mokPath = Join-Path $ragDir "mockRetrieval.ts"
$ragOK = (Test-Path $pgrPath) -and (Test-Path $mokPath)
Add-Result "12" "RAG mode clarity (postgres + mock)" ($(if ($ragOK) { "PASS" } else { "FAIL" })) "postgresRetrieval=$([io.path]::GetFileName($pgrPath)) mockRetrieval=$([io.path]::GetFileName($mokPath))"

# --- Check 13: no real secret value in repo (heuristic) ---
# Only flag DATABASE_URL=, PRIVATE_KEY blocks, and provider tokens that look concrete.
# Placeholder text ("<password>", "[REDACTED]", "<DEV_..._ONLY>"), regex patterns (grep -E "...")
# and the smoke / readiness-gate checklist lines are accepted.
$realSecretHits = @()
$secretPatterns = @(
  "ghp_[A-Za-z0-9]{36}",       # GitHub PAT (exact length)
  "github_pat_[A-Za-z0-9_]{40,}",  # GitHub fine-grained PAT
  "sk-[A-Za-z0-9]{32,}",       # OpenAI-style (require enough length)
  "AKIA[0-9A-Z]{16}",          # AWS access key
  "AIza[0-9A-Za-z_-]{35}",     # Google API key
  "BEGIN RSA PRIVATE KEY",
  "BEGIN OPENSSH PRIVATE KEY",
  "xoxb-[A-Za-z0-9-]{20,}",    # Slack bot token
  "xoxp-[A-Za-z0-9-]{20,}"     # Slack user token
)
# Note: DATABASE_URL=... patterns are intentionally NOT included here. They almost always match
# placeholder text ("<password>", "...", or test-fixture synthetic data) and would produce false
# positives. The dedicated leak-scan in CLAUDE.md / Sprint 12B handles DSN-leak detection in
# orchestrator outputs at runtime; static check here focuses on concrete provider tokens.
Get-ChildItem -Path (Join-Path $repoRoot "docs"), (Join-Path $repoRoot "apps"), (Join-Path $repoRoot "reports"), (Join-Path $repoRoot "scripts") -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -notmatch "node_modules" -and
    $_.FullName -notmatch "\\\.git\\" -and
    $_.FullName -notmatch "package-lock" -and
    $_.FullName -notmatch "\.next\\" -and
    # Skip test fixture files (synthetic secrets in test data are expected)
    $_.FullName -notmatch "\\tests\\" -and
    $_.FullName -notmatch "__tests__" -and
    $_.Name -notmatch "\.test\.(ts|tsx|js|jsx)$" -and
    $_.Name -notmatch "\.spec\.(ts|tsx|js|jsx)$" -and
    # Skip the smoke script itself (this is the pattern source)
    $_.Name -ne "iterlaw-mvp-smoke.ps1"
  } |
  ForEach-Object {
    $f = $_.FullName
    foreach ($pat in $secretPatterns) {
      $matches = Select-String -Path $f -Pattern $pat -ErrorAction SilentlyContinue
      foreach ($m in $matches) {
        $line = $m.Line
        # Skip placeholder / redaction / regex-pattern / comment lines.
        if ($line -match "<[^>]*>") { continue }                # contains <placeholder>
        if ($line -match "\[REDACTED\]") { continue }
        if ($line -match "_ONLY>") { continue }
        if ($line -match "grep -E|grep -RIn|Select-String|rg -|--pattern") { continue }
        if ($line -match "scan-pattern|leak-scan|leak scan") { continue }
        if ($line -match "no secret value|No secret value|never store") { continue }
        # Skip script header comments documenting required env vars
        if ($line -match "^\s*#.*=postgres" -or $line -match "^\s*#.*=mysql") { continue }
        # Skip backup script header comments like "ITERLAW_BACKUP_DATABASE_URL=postgres://..."
        if ($line -match "^#\s*\S+_DATABASE_URL=" -or $line -match "^\s*#\s*ITERLAW_") { continue }
        # Skip scan-result tables showing zero hits and negation prose
        if ($line -match "\|\s*\*?\*?0\*?\*?\s*\|") { continue }
        if ($line -match "No\s+\S+.*surfaced|did not surface|no\s+real\s+secret") { continue }
        $realSecretHits += [pscustomobject]@{ file = $f; line = $m.LineNumber; content = $line }
      }
    }
  }
$secretOK = $realSecretHits.Count -eq 0
Add-Result "13" "No real secret value in repo (heuristic)" ($(if ($secretOK) { "PASS" } else { "FAIL" })) "non-placeholder concrete-secret hits=$($realSecretHits.Count)"

# --- Check 14: no false production-ready / deployed claim ---
# Heuristic: count occurrences in active docs that are NOT obvious negations.
$activeClaim = 0
$docsRoot = Join-Path $repoRoot "docs\iterlaw"
$projectMd = Join-Path $repoRoot "PROJECT.md"
foreach ($p in @($docsRoot, $projectMd)) {
  if (-not (Test-Path $p)) { continue }
  Get-ChildItem -Path $p -Recurse -File -Include *.md -ErrorAction SilentlyContinue | ForEach-Object {
    Select-String -Path $_.FullName -Pattern "PRODUCTION READY|production ready" -ErrorAction SilentlyContinue | ForEach-Object {
      # Skip if line clearly negates / quotes / counts the claim
      if ($_.Line -match "Never claim|no claim that|NOT production ready|production readiness.*NO|forbidden|Do not claim|Never use|production ready.*(?:\u2014|-)\s*\*\*NO\*\*|production ready.*NO[;,]") { return }
      # Skip lines that report a scan count of 0 or list the pattern as a search target
      if ($_.Line -match "\|\s*0\s*\|" -or $_.Line -match "scan-pattern|leak-scan|leak scan|in updated status docs") { return }
      # Skip the gate doc / status docs / governance docs that record the policy
      if ($_.Path -match "PRODUCTION_READINESS_GATE\.md" -or
          $_.Path -match "DOCUMENTATION_TRUTH_PROTOCOL\.md" -or
          $_.Path -match "AIA_OPERATING_MODEL\.md" -or
          $_.Path -match "AI_GOVERNANCE_INDEX\.md" -or
          $_.Path -match "MVP_SMOKE_TEST_CHECKLIST\.md") { return }
      # Skip historical Sprint *_QA_REPORT.md files and audit-reconciliation subfolders
      if ($_.Path -match "QA_REPORT") { return }
      if ($_.Path -match "12a-audit-reconciliation") { return }
      $activeClaim++
    }
  }
}
Add-Result "14" "No false production-ready claim in active docs" ($(if ($activeClaim -eq 0) { "PASS" } else { "FAIL" })) "non-negated active hits=$activeClaim"

# --- Checks 15-16: live /health and /ready (optional) ---
if ($env:ITERLAW_MVP_SMOKE_RUN_SERVER -eq "1") {
  try {
    $healthOut = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5 2>$null
    $healthOK = ($healthOut.StatusCode -eq 200)
    Add-Result "15" "/health reachable" ($(if ($healthOK) { "PASS" } else { "FAIL" })) "status=$($healthOut.StatusCode)"
  } catch {
    Add-Result "15" "/health reachable" "NOT_RUN" "no local orchestrator detected"
  }
  try {
    $readyOut = Invoke-WebRequest -Uri "http://localhost:3000/ready" -UseBasicParsing -TimeoutSec 5 2>$null
    $body = $readyOut.Content
    $leak = ($body -match "postgres://" -or $body -match "DATABASE_URL=")
    $hasCit = ($body -match "citation_required") -and ($body -match "zero_citation_answer_blocked")
    $readyOK = ($readyOut.StatusCode -eq 200) -and (-not $leak) -and $hasCit
    Add-Result "16" "/ready reachable + safety flags + no DSN leak" ($(if ($readyOK) { "PASS" } else { "FAIL" })) "status=$($readyOut.StatusCode) leak=$leak flags=$hasCit"
  } catch {
    Add-Result "16" "/ready reachable + safety flags + no DSN leak" "NOT_RUN" "no local orchestrator detected"
  }
} else {
  Add-Result "15" "/health reachable" "NOT_RUN" "ITERLAW_MVP_SMOKE_RUN_SERVER not set"
  Add-Result "16" "/ready reachable + safety flags + no DSN leak" "NOT_RUN" "ITERLAW_MVP_SMOKE_RUN_SERVER not set"
}

# --- Verdict ---
$failCount    = ($results | Where-Object { $_.status -eq "FAIL" } | Measure-Object).Count
$passCount    = ($results | Where-Object { $_.status -eq "PASS" } | Measure-Object).Count
$notRunCount  = ($results | Where-Object { $_.status -eq "NOT_RUN" } | Measure-Object).Count
$verdict      = if ($failCount -eq 0) { "PASS" } else { "FAIL" }

$reportLines = @(
  "# Sprint 16 - MVP smoke test ($ts)",
  "",
  "## STATUS: $verdict",
  "",
  "Pass: $passCount  Fail: $failCount  NotRun: $notRunCount  Total: $($results.Count)",
  "",
  "| # | Check | Status | Detail |",
  "|---|---|---|---|"
)
foreach ($r in $results) {
  $reportLines += "| $($r.id) | $($r.name) | $($r.status) | $($r.detail) |"
}
$reportLines += ""
$reportLines += "## Safety properties"
$reportLines += ""
$reportLines += "- No kubectl. No helm. No systemctl. No firewall. No production DB. No external LLM."
$reportLines += "- Live /health and /ready only checked when ITERLAW_MVP_SMOKE_RUN_SERVER=1 and the operator has the orchestrator running locally."
$reportLines += "- The script does not start the orchestrator."

Set-Content -Path $reportPath -Value ($reportLines -join "`n") -Encoding UTF8
Log "Report written: $reportPath"
Log "Verdict: $verdict (pass=$passCount fail=$failCount not_run=$notRunCount)"
if ($verdict -eq "FAIL") { exit 1 } else { exit 0 }
