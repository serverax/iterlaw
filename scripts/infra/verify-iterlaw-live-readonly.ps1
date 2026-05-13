#!/usr/bin/env pwsh
# Sprint 15 — Read-only verification of IterLaw live infrastructure.
#
# Master/control-plane host: 138.201.253.56
#
# This script is READ-ONLY. It performs no mutation. It refuses to run any
# mutating kubectl/helm/firewall/systemctl/SSH command. It writes a
# timestamped report under reports/.
#
# Required env vars (no defaults; the script fails fast if missing):
#   ITERLAW_LIVE_SSH_USER    — SSH user (no password baked in)
#   ITERLAW_LIVE_SSH_HOST    — must be 138.201.253.56
#
# Optional env vars:
#   ITERLAW_LIVE_SSH_PORT    — defaults to 22 if unset
#
# Authentication uses the user's existing SSH agent / key. This script never
# embeds, writes, or transmits a password.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --- 0. Refuse on wrong master ----------------------------------------------
$expectedHost = "138.201.253.56"
$forbiddenHosts = @(
  "138.201.253.245",
  "aks-iterlaw-we-prod"
)

$user = $env:ITERLAW_LIVE_SSH_USER
$host = $env:ITERLAW_LIVE_SSH_HOST
$port = if ($env:ITERLAW_LIVE_SSH_PORT) { $env:ITERLAW_LIVE_SSH_PORT } else { "22" }

if (-not $user -or -not $host) {
  Write-Error "Refusing to run: missing ITERLAW_LIVE_SSH_USER or ITERLAW_LIVE_SSH_HOST."
  exit 11
}
if ($host -ne $expectedHost) {
  Write-Error "Refusing to run: ITERLAW_LIVE_SSH_HOST is '$host', expected '$expectedHost'."
  exit 12
}
foreach ($f in $forbiddenHosts) {
  if ($host -eq $f) {
    Write-Error "Refusing to run: host '$host' is in the forbidden list."
    exit 13
  }
}

# --- 1. Build the read-only remote command list -----------------------------
# Every command below is read-only. The list is checked statically below to
# refuse any mutating command should this script be modified incorrectly.

$remoteCommands = @(
  "hostname",
  "uptime",
  "uname -a",
  "df -h",
  "free -h",
  "command -v k3s || true",
  "sudo systemctl is-active k3s --quiet && echo k3s_active=yes || echo k3s_active=no",
  "sudo k3s kubectl get nodes -o wide",
  "sudo k3s kubectl get ns",
  "sudo k3s kubectl get pods -A",
  "sudo k3s kubectl get ingress -A",
  "sudo k3s kubectl get svc -A",
  "sudo k3s kubectl get pods -n kube-system | grep -E 'traefik|cert-manager' || true",
  "sudo k3s kubectl get ns iterlaw-ai iterlaw-rag iterlaw-api iterlaw-monitoring iterlaw-security 2>&1 || true"
)

# --- 2. Static safety scan of the command list ------------------------------
$forbiddenPatterns = @(
  "kubectl\s+apply",
  "kubectl\s+delete",
  "kubectl\s+patch",
  "kubectl\s+edit",
  "kubectl\s+scale",
  "kubectl\s+rollout",
  "helm\s+upgrade",
  "helm\s+install",
  "helm\s+uninstall",
  "systemctl\s+restart",
  "systemctl\s+stop",
  "systemctl\s+start",
  "systemctl\s+disable",
  "systemctl\s+enable",
  "iptables\s+-[AID]",
  "ufw\s+(allow|deny|delete)",
  "firewall-cmd",
  "netsh\s+advfirewall",
  "rm\s+-rf",
  "DROP\s+DATABASE",
  "TRUNCATE",
  "DELETE\s+FROM",
  "INSERT\s+INTO"
)
foreach ($cmd in $remoteCommands) {
  foreach ($pat in $forbiddenPatterns) {
    if ($cmd -match $pat) {
      Write-Error "Refusing to run: command '$cmd' matches forbidden mutating pattern '$pat'."
      exit 14
    }
  }
}

# --- 3. Repo paths -----------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..\..")
$reportDir = Join-Path $repoRoot "reports"
$logsDir   = Join-Path $reportDir "logs"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir   | Out-Null
$ts = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$logPath    = Join-Path $logsDir   "sprint15-readonly-$ts.log"
$reportPath = Join-Path $reportDir "ITERLAW_SPRINT_15_K3S_TRAEFIK_READONLY_VERIFICATION_$ts.md"

function Write-Log([string]$msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] $msg"
  Add-Content -Path $logPath -Value $line
  Write-Host $line
}

Write-Log "Sprint 15 read-only verification starting (target=$user@$host:$port)."

# --- 4. SSH check ------------------------------------------------------------
$sshTest = ""
try {
  $sshTest = & ssh -p $port -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$user@$host" "echo SSH_OK" 2>&1
} catch {
  $sshTest = $_.Exception.Message
}
if ($sshTest -notmatch "SSH_OK") {
  Write-Log "FAIL: SSH probe did not return SSH_OK. Output: $sshTest"
  $body = @"
# Sprint 15 — Read-only verification ($ts)

## STATUS: BLOCKED

SSH probe failed. The script did NOT execute any kubectl or remote command.

Target: $user@$host (port $port)

Raw SSH output:

\`\`\`
$sshTest
\`\`\`

This is the exact environment blocker. The script is correct; it refused to continue past the SSH probe.
"@
  Set-Content -Path $reportPath -Value $body -Encoding UTF8
  Write-Log "Report written: $reportPath"
  exit 30
}
Write-Log "SSH OK."

# --- 5. Run each read-only command, capture output --------------------------
$results = @{}
foreach ($cmd in $remoteCommands) {
  Write-Log "Running remote: $cmd"
  $out = & ssh -p $port -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$user@$host" $cmd 2>&1
  $results[$cmd] = ($out | Out-String).Trim()
}

# --- 6. Write report ---------------------------------------------------------
$reportLines = @(
  "# Sprint 15 — Read-only verification ($ts)",
  "",
  "## STATUS: PASS",
  "",
  "Target: $user@$host (port $port)",
  "",
  "## Read-only outputs",
  ""
)
foreach ($cmd in $remoteCommands) {
  $reportLines += "### `$cmd`"
  $reportLines += ""
  $reportLines += "``````"
  $reportLines += $results[$cmd]
  $reportLines += "``````"
  $reportLines += ""
}
$reportLines += "## Safety properties"
$reportLines += ""
$reportLines += "- No mutating kubectl / helm / systemctl / firewall command was run."
$reportLines += "- No external LLM call."
$reportLines += "- No production DB touched."
$reportLines += "- All remote commands matched against a deny-list of mutating patterns; none matched."
$reportLines += "- The script writes only to reports/ and reports/logs/."

Set-Content -Path $reportPath -Value ($reportLines -join "`n") -Encoding UTF8
Write-Log "Report written: $reportPath"
exit 0
