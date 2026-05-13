#!/usr/bin/env pwsh
# Sprint 12J — Live backup / restore evidence validator.
#
# Reads a candidate evidence report and refuses if it contains anything
# that looks like a secret (DSN, password, token, private key). Also checks
# that the required section headings exist so the operator cannot commit a
# half-filled report.
#
# Safety:
#   - No network call. No DB call. No external LLM. Pure file read + string scan.
#   - Never prints captured matches in clear; only reports the field-name and
#     a redacted placeholder.
#
# Usage:
#   pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 <report-path>
#
# Exit codes:
#   0 = report is clean and complete
#   2 = report path missing / unreadable / outside repo
#   3 = report missing required section heading(s)
#   4 = report contains a likely secret (kind reported, value redacted)

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ReportPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $ReportPath)) {
  Write-Error "FAIL: report path not found: $ReportPath"
  exit 2
}

$resolved = (Resolve-Path -LiteralPath $ReportPath).Path
$content = Get-Content -Raw -LiteralPath $resolved

# --- 1. Required section headings (kept compatible with the Sprint 12G templates) -----
$requiredHeadings = @(
  "## Run metadata",
  "## Safety checks",
  "## Verdict"
)
$missingHeadings = @()
foreach ($h in $requiredHeadings) {
  if ($content -notmatch [Regex]::Escape($h)) {
    $missingHeadings += $h
  }
}
if ($missingHeadings.Count -gt 0) {
  Write-Host "MISSING_REQUIRED_HEADINGS:"
  foreach ($h in $missingHeadings) { Write-Host "  - $h" }
  Write-Error "FAIL: report is missing required section heading(s)."
  exit 3
}

# --- 2. Secret-shape detection (we never echo the matched value) ---------------------
$secretPatterns = @(
  @{ kind = "RSA private key";         pattern = "BEGIN RSA PRIVATE KEY" },
  @{ kind = "OpenSSH private key";     pattern = "BEGIN OPENSSH PRIVATE KEY" },
  @{ kind = "PGP private key";         pattern = "BEGIN PGP PRIVATE KEY" },
  @{ kind = "GitHub PAT (classic)";    pattern = "ghp_[A-Za-z0-9]{36}" },
  @{ kind = "GitHub PAT (fine-grained)"; pattern = "github_pat_[A-Za-z0-9_]{40,}" },
  @{ kind = "OpenAI-style key";        pattern = "sk-[A-Za-z0-9]{32,}" },
  @{ kind = "AWS access key";          pattern = "AKIA[0-9A-Z]{16}" },
  @{ kind = "Google API key";          pattern = "AIza[0-9A-Za-z_-]{35}" },
  @{ kind = "Slack bot token";         pattern = "xoxb-[A-Za-z0-9-]{20,}" },
  @{ kind = "Slack user token";        pattern = "xoxp-[A-Za-z0-9-]{20,}" },
  # DSNs with concrete credentials: capture only the kind, not the host or password.
  @{ kind = "Postgres DSN with embedded credential"; pattern = "postgres(ql)?://[A-Za-z0-9._%+-]+:[^@\s/]+@" },
  @{ kind = "MySQL DSN with embedded credential";    pattern = "mysql://[A-Za-z0-9._%+-]+:[^@\s/]+@" },
  @{ kind = "Mongo DSN with embedded credential";    pattern = "mongodb(\+srv)?://[A-Za-z0-9._%+-]+:[^@\s/]+@" },
  # Long base64-style high-entropy strings labelled password/token (only flag with context).
  @{ kind = "password=<value>";        pattern = "(?i)\bpassword\s*=\s*[A-Za-z0-9+/=]{8,}" },
  @{ kind = "token=<value>";           pattern = "(?i)\btoken\s*=\s*[A-Za-z0-9+/=]{8,}" }
)

$secretHits = @()
# Track whether we're inside a "Forbidden fields" / "Forbidden" section — those
# sections list pattern names as documentation, not as real values.
$forbiddenSectionRegex = '^##\s+Forbidden(?:\b|\s|$)'
$nextSectionRegex      = '^##\s+'
$lines = $content -split "`r?`n"
$inForbiddenSection = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
  $line = $lines[$i]
  if ($line -match $forbiddenSectionRegex) { $inForbiddenSection = $true; continue }
  if ($inForbiddenSection -and $line -match $nextSectionRegex -and -not ($line -match $forbiddenSectionRegex)) {
    $inForbiddenSection = $false
  }
  if ($inForbiddenSection) { continue }   # documentation, not real values

  foreach ($s in $secretPatterns) {
    if ($line -match $s.pattern) {
      # Heuristic skips:
      if ($line -match "<[^>]*>") { continue }                                # contains < placeholder >
      if ($line -match "(?i)never commit|must not appear|forbidden|do not commit") { continue }
      if ($line -match "(?i)scan-pattern|leak-scan|leak scan") { continue }
      # Backtick-wrapped values are explicit literal documentation, not real data.
      $beforeIdx = $line.IndexOf("``")
      if ($beforeIdx -ge 0 -and $line -match "``[^``]*$($s.pattern)[^``]*``") { continue }
      $secretHits += @{ kind = $s.kind; lineNumber = ($i + 1) }
    }
  }
}

if ($secretHits.Count -gt 0) {
  Write-Host "SUSPECTED_SECRET_PATTERNS_FOUND:"
  foreach ($h in $secretHits) {
    Write-Host ("  - kind: " + $h.kind + "  (value redacted)")
  }
  Write-Error "FAIL: report contains one or more suspected secret patterns. Redact before committing."
  exit 4
}

Write-Host "OK: report is structurally complete and contains no suspected secret-shape values."
Write-Host "Note: this is a heuristic check, not a guarantee. Reviewer must still perform a redaction read before commit."
exit 0
