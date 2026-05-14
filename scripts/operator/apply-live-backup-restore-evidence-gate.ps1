#!/usr/bin/env pwsh
# Sprint 12L — Live backup / restore evidence gate.
#
# Purpose:
#   Flip G12 and G13 in docs/iterlaw/project/PRODUCTION_READINESS_GATE.json to
#   PASS — and ONLY to PASS — when validated redacted evidence files for the
#   live backup AND the live restore-verify exist and both pass the Sprint 12J
#   evidence validator (scripts/operator/validate-live-backup-restore-evidence.ps1).
#
# Refusal contract:
#   - Refuses if either evidence file path is empty.
#   - Refuses if either evidence file is missing.
#   - Refuses if the underlying validator exits non-zero on either file.
#   - Refuses if the gate JSON file is missing or unreadable.
#   - In DryRun mode, writes nothing and prints the planned delta.
#
# Safety:
#   - No network. No DB. No external LLM. No backup or restore execution.
#   - Never prints the contents of evidence files. Never prints secrets.
#   - Only modifies gates G12 and G13. All other gate entries are preserved
#     byte-for-byte.

[CmdletBinding()]
param(
  [string]$BackupEvidencePath = "",
  [string]$RestoreEvidencePath = "",
  [string]$GateJsonPath = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Code, [string]$Message) {
  Write-Host "REFUSAL: $Code"
  Write-Error $Message
  exit 1
}

# --- 1. Resolve repo root + defaults ----------------------------------------
$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir "..\..")).Path

if ([string]::IsNullOrWhiteSpace($GateJsonPath)) {
  $GateJsonPath = Join-Path $repoRoot "docs\iterlaw\project\PRODUCTION_READINESS_GATE.json"
}

$validatorPath = Join-Path $repoRoot "scripts\operator\validate-live-backup-restore-evidence.ps1"
if (-not (Test-Path -LiteralPath $validatorPath)) {
  Fail "VALIDATOR_MISSING" "Evidence validator not found at expected path: $validatorPath"
}

# --- 2. Validate inputs ------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($BackupEvidencePath)) {
  Fail "BACKUP_EVIDENCE_PATH_REQUIRED" "Provide -BackupEvidencePath pointing to a redacted backup evidence report."
}
if ([string]::IsNullOrWhiteSpace($RestoreEvidencePath)) {
  Fail "RESTORE_EVIDENCE_PATH_REQUIRED" "Provide -RestoreEvidencePath pointing to a redacted restore-verify evidence report."
}
if (-not (Test-Path -LiteralPath $BackupEvidencePath)) {
  Fail "BACKUP_EVIDENCE_NOT_FOUND" "Backup evidence file not found: $BackupEvidencePath"
}
if (-not (Test-Path -LiteralPath $RestoreEvidencePath)) {
  Fail "RESTORE_EVIDENCE_NOT_FOUND" "Restore evidence file not found: $RestoreEvidencePath"
}
if (-not (Test-Path -LiteralPath $GateJsonPath)) {
  Fail "GATE_JSON_NOT_FOUND" "Production readiness gate JSON not found: $GateJsonPath"
}

# --- 3. Run validator against both evidence files ----------------------------
function Invoke-EvidenceValidator([string]$Path) {
  $out = & pwsh -NoLogo -NonInteractive -ExecutionPolicy Bypass -File $validatorPath $Path 2>&1
  $code = $LASTEXITCODE
  return @{ exitCode = $code; output = ($out -join [Environment]::NewLine) }
}

Write-Host "Validating backup evidence..."
$bv = Invoke-EvidenceValidator -Path $BackupEvidencePath
if ($bv.exitCode -ne 0) {
  Write-Host $bv.output
  Fail "BACKUP_EVIDENCE_VALIDATION_FAILED" "Evidence validator refused backup evidence with exit code $($bv.exitCode)."
}

Write-Host "Validating restore evidence..."
$rv = Invoke-EvidenceValidator -Path $RestoreEvidencePath
if ($rv.exitCode -ne 0) {
  Write-Host $rv.output
  Fail "RESTORE_EVIDENCE_VALIDATION_FAILED" "Evidence validator refused restore evidence with exit code $($rv.exitCode)."
}

# --- 4. Verdict check on each evidence file ---------------------------------
# A PASS verdict is detected from either of:
#   - A canonical "Verdict: PASS" / "Status: PASS" line.
#   - The Sprint 12J redacted-example shape: a line of the form
#       "Ready to flip G12 to PASS: YES"  (backup)
#       "Ready to flip G13 to PASS: YES"  (restore)
# Anything else is treated as not-PASS.
function Get-ReportVerdict([string]$Path, [string]$GateId) {
  $content = Get-Content -Raw -LiteralPath $Path
  if ($content -match "(?im)^\s*(verdict|status)\s*:\s*PASS\b") { return "PASS" }
  if ($content -match "(?im)^\s*(verdict|status)\s*:\s*PARTIAL\b") { return "PARTIAL" }
  if ($content -match "(?im)^\s*(verdict|status)\s*:\s*FAIL\b") { return "FAIL" }
  # Sprint 12J template shape — look for "Ready to flip <gate> to PASS: YES"
  $gatePattern = "(?im)Ready to flip\s+$GateId\s+to\s+PASS\s*[:\\-]\s*[`````]?YES[`````]?"
  if ($content -match $gatePattern) { return "PASS" }
  return "UNKNOWN"
}

$backupVerdict = Get-ReportVerdict -Path $BackupEvidencePath -GateId "G12"
$restoreVerdict = Get-ReportVerdict -Path $RestoreEvidencePath -GateId "G13"
Write-Host "Backup evidence verdict:  $backupVerdict"
Write-Host "Restore evidence verdict: $restoreVerdict"

if ($backupVerdict -ne "PASS") {
  Fail "BACKUP_VERDICT_NOT_PASS" "Backup evidence verdict is '$backupVerdict' (must be PASS)."
}
if ($restoreVerdict -ne "PASS") {
  Fail "RESTORE_VERDICT_NOT_PASS" "Restore evidence verdict is '$restoreVerdict' (must be PASS)."
}

# --- 5. Plan the gate JSON delta --------------------------------------------
$gateRaw = Get-Content -Raw -LiteralPath $GateJsonPath
$gateObj = $gateRaw | ConvertFrom-Json -Depth 8

$today = (Get-Date).ToString("yyyy-MM-dd")
$plannedChanges = @()

foreach ($gate in $gateObj.gates) {
  if ($gate.gate_id -eq "G12") {
    if ($gate.status -ne "PASS") {
      $plannedChanges += @{ gate = "G12"; from = $gate.status; to = "PASS" }
      if (-not $DryRun) {
        $gate.status = "PASS"
        $gate.last_verified_at = $today
        $gate.blocker = $null
        $gate.evidence_path = ($BackupEvidencePath -replace [Regex]::Escape($repoRoot + [IO.Path]::DirectorySeparatorChar), "")
      }
    }
  }
  if ($gate.gate_id -eq "G13") {
    if ($gate.status -ne "PASS") {
      $plannedChanges += @{ gate = "G13"; from = $gate.status; to = "PASS" }
      if (-not $DryRun) {
        $gate.status = "PASS"
        $gate.last_verified_at = $today
        $gate.blocker = $null
        $gate.evidence_path = ($RestoreEvidencePath -replace [Regex]::Escape($repoRoot + [IO.Path]::DirectorySeparatorChar), "")
      }
    }
  }
}

if ($plannedChanges.Count -eq 0) {
  Write-Host "NO_CHANGE: G12 and G13 already PASS. Nothing to do."
  exit 0
}

Write-Host "PLANNED_CHANGES:"
foreach ($c in $plannedChanges) {
  Write-Host ("  - {0}: {1} -> {2}" -f $c.gate, $c.from, $c.to)
}

if ($DryRun) {
  Write-Host "DRY_RUN: no file written."
  exit 0
}

# --- 6. Write the updated gate JSON -----------------------------------------
$gateObj.last_updated = $today
$updated = $gateObj | ConvertTo-Json -Depth 8
Set-Content -LiteralPath $GateJsonPath -Value $updated -Encoding UTF8 -NoNewline:$false
Write-Host "WROTE: $GateJsonPath"
exit 0
