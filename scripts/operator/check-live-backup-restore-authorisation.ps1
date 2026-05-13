#!/usr/bin/env pwsh
# Sprint 12G — Live backup / restore authorisation safety check.
#
# This script reads the operator-local approval file at the env-overridable
# path (default: $HOME\.iterlaw\live-backup-restore-approval.json) and checks
# that the required flags + identifiers are present and consistent. It NEVER
# prints field values. It NEVER connects to a DB or network. It exits non-zero
# if any required env var or approval field is missing.
#
# Refuses to run if any forbidden indicator is present in the operator host
# context (KUBECONTEXT, HOSTNAME) — exit 10.
#
# Refuses if approval file or env vars are missing — exit 11+.
#
# Returns 0 only when:
#   - Required env-var NAMES exist (values are not inspected beyond presence).
#   - Approval file exists at the expected path.
#   - Required boolean approval fields are true.
#   - Operator and reviewer are non-empty and different.
#   - Authorisation window contains today.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --- 0. Refuse on production-host indicators --------------------------------
$forbiddenIndicators = @(
  "iterlaw-prod",
  "aks-iterlaw-we-prod",
  "PRODUCTION",
  "prod-master"
)
foreach ($indicator in $forbiddenIndicators) {
  if ($env:KUBECONTEXT -and $env:KUBECONTEXT -match $indicator) {
    Write-Error "Refusing to run: KUBECONTEXT contains forbidden indicator."
    exit 10
  }
  if ($env:HOSTNAME -and $env:HOSTNAME -match $indicator) {
    Write-Error "Refusing to run: HOSTNAME contains forbidden indicator."
    exit 10
  }
}

# --- 1. Required env var NAMES exist (we never read or print values) -------
$requiredEnvVars = @(
  "ITERLAW_LIVE_BACKUP_APPROVED",
  "ITERLAW_LIVE_BACKUP_OPERATOR",
  "ITERLAW_LIVE_BACKUP_TARGET",
  "ITERLAW_LIVE_RESTORE_VERIFY_APPROVED",
  "ITERLAW_LIVE_RESTORE_VERIFY_TARGET"
)
$missingEnvVars = @()
foreach ($v in $requiredEnvVars) {
  $present = $false
  try {
    if ([Environment]::GetEnvironmentVariable($v)) { $present = $true }
  } catch {
    $present = $false
  }
  if (-not $present) { $missingEnvVars += $v }
}
if ($missingEnvVars.Count -gt 0) {
  Write-Host "MISSING_ENV_VARS:"
  foreach ($v in $missingEnvVars) { Write-Host "  - $v" }
  Write-Error "Refusing: missing required env-var names (values are not inspected)."
  exit 11
}

# --- 2. Approval file path -------------------------------------------------
$approvalPath = if ($env:ITERLAW_LIVE_APPROVAL_FILE) {
  $env:ITERLAW_LIVE_APPROVAL_FILE
} else {
  Join-Path $HOME ".iterlaw\live-backup-restore-approval.json"
}

if (-not (Test-Path $approvalPath)) {
  Write-Error "Refusing: approval file not found at expected operator-local path."
  Write-Host "Expected path was constructed but not printed to avoid identifier leak."
  exit 12
}

# --- 3. Parse approval file, validate required fields -----------------------
try {
  $raw = Get-Content -Raw -Path $approvalPath
  $approval = $raw | ConvertFrom-Json
} catch {
  Write-Error "Refusing: approval file is not valid JSON."
  exit 13
}

$problems = @()

if (-not $approval.operator -or [string]::IsNullOrWhiteSpace($approval.operator)) {
  $problems += "operator missing"
}
if (-not $approval.reviewer -or [string]::IsNullOrWhiteSpace($approval.reviewer)) {
  $problems += "reviewer missing"
}
if ($approval.operator -and $approval.reviewer -and ($approval.operator -eq $approval.reviewer)) {
  $problems += "operator and reviewer must differ"
}
if ($approval.backup_approved -ne $true -and $approval.restore_verify_approved -ne $true) {
  $problems += "neither backup_approved nor restore_verify_approved is true"
}

# Window check
$today = (Get-Date).ToString("yyyy-MM-dd")
function ParseDateOrNull($v) {
  if (-not $v) { return $null }
  try { return [datetime]::ParseExact($v, "yyyy-MM-dd", $null) } catch { return $null }
}
$dateStart = ParseDateOrNull $approval.authorisation_date
$dateEnd   = ParseDateOrNull $approval.authorisation_window_end
$now       = [datetime]::ParseExact($today, "yyyy-MM-dd", $null)
if (-not $dateStart -or -not $dateEnd) {
  $problems += "authorisation_date or authorisation_window_end missing/invalid"
} elseif ($now -lt $dateStart -or $now -gt $dateEnd) {
  $problems += "today is outside the authorisation window"
}

if ($problems.Count -gt 0) {
  Write-Host "AUTHORISATION_PROBLEMS:"
  foreach ($p in $problems) { Write-Host "  - $p" }
  Write-Error "Refusing: approval file does not meet authorisation requirements."
  exit 14
}

# --- 4. Success — but never print operator or target values -----------------
Write-Host "Authorisation check: OK"
Write-Host "  required env vars present (values not inspected)"
Write-Host "  approval file present and well-formed"
Write-Host "  operator != reviewer"
Write-Host "  authorisation window contains today"
Write-Host "Note: this script does NOT execute backup or restore. Operator must invoke the documented scripts manually."
exit 0
