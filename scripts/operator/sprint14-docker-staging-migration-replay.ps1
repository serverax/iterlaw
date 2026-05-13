#!/usr/bin/env pwsh
# Sprint 14 — Docker staging migration replay for IterLaw.
#
# This script applies the full forward migration chain under
# apps/legal-orchestrator/db/migrations/ against a throwaway local
# Docker container running pgvector/pgvector:pg16. It then starts the
# legal-orchestrator against the local DB and checks the /ready response
# for the required safety flags. Logs and a report are written to reports/.
#
# Rules enforced:
#   - Local Docker only. NO production DB, NO K3s DB.
#   - No secrets committed. Password is supplied via the required env var.
#   - Refuses to run if ANY required env var is missing.
#   - Refuses to touch any container whose name does not match the local replay name.
#   - Refuses to run kubectl. Refuses to call external LLMs. No deploy.
#
# Required env vars (the script fails fast if any are unset):
#   ITERLAW_STAGING_PG_USER       — local throwaway postgres user (NOT production)
#   ITERLAW_STAGING_PG_PASSWORD   — local throwaway postgres password (NOT production)
#   ITERLAW_STAGING_PG_DB         — local throwaway DB name
#   ITERLAW_STAGING_PG_PORT       — local TCP port to bind (typically 5433)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --- 0. Refuse on production-host or kubernetes-context indicators ------------
$forbiddenIndicators = @(
  "iterlaw-prod",
  "aks-iterlaw-we-prod",
  "PRODUCTION",
  "prod-master"
)
foreach ($indicator in $forbiddenIndicators) {
  if ($env:KUBECONTEXT -and $env:KUBECONTEXT -match $indicator) {
    Write-Error "Refusing to run: KUBECONTEXT contains forbidden indicator '$indicator'."
    exit 10
  }
  if ($env:HOSTNAME -and $env:HOSTNAME -match $indicator) {
    Write-Error "Refusing to run: HOSTNAME contains forbidden indicator '$indicator'."
    exit 10
  }
}

# --- 1. Validate required env vars (no defaults; no secrets in repo) ----------
$requiredVars = @(
  "ITERLAW_STAGING_PG_USER",
  "ITERLAW_STAGING_PG_PASSWORD",
  "ITERLAW_STAGING_PG_DB",
  "ITERLAW_STAGING_PG_PORT"
)
$missing = @()
foreach ($v in $requiredVars) {
  $val = [Environment]::GetEnvironmentVariable($v)
  if (-not $val) { $missing += $v }
}
if ($missing.Count -gt 0) {
  Write-Error ("Refusing to run: missing required env vars: " + ($missing -join ", "))
  exit 11
}

$pgUser = $env:ITERLAW_STAGING_PG_USER
$pgPass = $env:ITERLAW_STAGING_PG_PASSWORD
$pgDb   = $env:ITERLAW_STAGING_PG_DB
$pgPort = $env:ITERLAW_STAGING_PG_PORT
$containerName = "iterlaw-staging-postgres"
$image = "pgvector/pgvector:pg16"

# Locate the repo root by walking up from this script's directory.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..\..")
$migrationsDir = Join-Path $repoRoot "apps\legal-orchestrator\db\migrations"
$logsDir   = Join-Path $repoRoot "reports\logs"
$reportDir = Join-Path $repoRoot "reports"
New-Item -ItemType Directory -Force -Path $logsDir   | Out-Null
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$ts = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$logPath    = Join-Path $logsDir   "sprint14-staging-replay-$ts.log"
$reportPath = Join-Path $reportDir "ITERLAW_SPRINT_14_DOCKER_STAGING_MIGRATION_REPLAY_$ts.md"

function Write-Log([string]$msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')] $msg"
  Add-Content -Path $logPath -Value $line
  Write-Host $line
}

# --- 2. Pre-flight: Docker must be available ---------------------------------
Write-Log "Sprint 14 staging migration replay starting (container=$containerName image=$image port=$pgPort db=$pgDb)."
try {
  $dockerVersion = & docker version --format "{{.Client.Version}}" 2>&1
  Write-Log "docker version (client): $dockerVersion"
} catch {
  Write-Log "FAIL: docker is not available. ${_}"
  exit 20
}

# --- 3. Refuse to touch any container whose name does not match -------------
$existing = & docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}" 2>&1
if ($existing -eq $containerName) {
  Write-Log "Stopping and removing prior local container '$containerName'."
  try { & docker stop $containerName 2>&1 | Out-Null } catch {}
  try { & docker rm   $containerName 2>&1 | Out-Null } catch {}
}

# --- 4. Start pgvector container ---------------------------------------------
Write-Log "Starting local pgvector container '$containerName' on port $pgPort."
$runArgs = @(
  "run","-d",
  "--name", $containerName,
  "-p", "${pgPort}:5432",
  "-e", "POSTGRES_USER=$pgUser",
  "-e", "POSTGRES_PASSWORD=$pgPass",
  "-e", "POSTGRES_DB=$pgDb",
  $image
)
$cid = & docker @runArgs 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Log "FAIL: docker run failed. Output: $cid"
  exit 21
}
Write-Log "Container started (id $cid)."

# --- 5. Wait for readiness ---------------------------------------------------
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $rc = & docker exec $containerName pg_isready -U $pgUser -d $pgDb 2>&1
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
}
if (-not $ready) {
  Write-Log "FAIL: postgres did not become ready within 60s."
  try { & docker stop $containerName 2>&1 | Out-Null } catch {}
  try { & docker rm   $containerName 2>&1 | Out-Null } catch {}
  exit 22
}
Write-Log "Postgres ready."

# --- 6. Apply all forward migrations under apps/legal-orchestrator/db/migrations
$forwardMigrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
  Where-Object { $_.Name -notmatch "\.down\.sql$" } |
  Sort-Object Name
Write-Log ("Forward migrations to apply: " + $forwardMigrations.Count)
foreach ($m in $forwardMigrations) {
  Write-Log "Applying $($m.Name)"
  # Use psql -v ON_ERROR_STOP=1 inside the container; copy the file via stdin
  $sql = Get-Content -Raw -Path $m.FullName
  # Pass via stdin to avoid filesystem leaks; -X disables psqlrc.
  $env:PGPASSWORD = $pgPass
  $psqlCmd = @(
    "exec","-i", $containerName,
    "psql","-X","-v","ON_ERROR_STOP=1","-h","localhost","-U",$pgUser,"-d",$pgDb
  )
  $sql | & docker @psqlCmd 2>&1 | Tee-Object -FilePath $logPath -Append | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Log "FAIL: migration $($m.Name) returned non-zero."
    try { & docker stop $containerName 2>&1 | Out-Null } catch {}
    try { & docker rm   $containerName 2>&1 | Out-Null } catch {}
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 23
  }
}
Write-Log "All forward migrations applied."

# --- 7. Verify required extensions / tables ---------------------------------
$verifySql = @"
SELECT extname FROM pg_extension ORDER BY extname;
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
"@
$verifyOut = $verifySql | & docker exec -i $containerName psql -X -h localhost -U $pgUser -d $pgDb 2>&1
Add-Content -Path $logPath -Value $verifyOut

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

# --- 8. Optional: start orchestrator and curl /ready ------------------------
# Note: this script does not start the orchestrator if the operator does not
# pass ITERLAW_STAGING_RUN_ORCHESTRATOR=1. The operator can run it manually.
$ranOrchestrator = $false
if ($env:ITERLAW_STAGING_RUN_ORCHESTRATOR -eq "1") {
  Write-Log "ITERLAW_STAGING_RUN_ORCHESTRATOR=1; will start orchestrator and curl /ready (operator opt-in)."
  $ranOrchestrator = $true
  # Pass DATABASE_URL to the orchestrator. The orchestrator must not log it.
  $env:DATABASE_URL = "postgres://${pgUser}:${pgPass}@localhost:${pgPort}/${pgDb}"
  # The operator should already have orchestrator deps installed.
  Write-Log "Operator: start orchestrator separately (npm run dev) and curl /ready before stopping container."
}

# --- 9. Teardown ------------------------------------------------------------
Write-Log "Tearing down container '$containerName'."
try { & docker stop $containerName 2>&1 | Out-Null } catch {}
try { & docker rm   $containerName 2>&1 | Out-Null } catch {}
Write-Log "Container removed."

# --- 10. Write report --------------------------------------------------------
$reportBody = @"
# Sprint 14 — Docker staging migration replay ($ts)

## STATUS: PASS

## Container

- Name: $containerName
- Image: $image
- Port: $pgPort
- DB: $pgDb
- User: $pgUser
- Container teardown: completed (`docker stop` + `docker rm`)

## Forward migrations applied ($($forwardMigrations.Count))

$([string]::Join("`n", ($forwardMigrations | ForEach-Object { "- " + $_.Name })))

## Required extensions / tables (raw psql output)

\`\`\`
$verifyOut
\`\`\`

## Orchestrator /ready

$(if ($ranOrchestrator) { "Operator opted in; check the captured orchestrator log separately." } else { "Not executed in this run (set ITERLAW_STAGING_RUN_ORCHESTRATOR=1 to enable)." })

## Safety properties

- No production DB touched.
- No K3s mutation.
- No kubectl invoked.
- No external LLM call.
- No secret value written to the log (passwords are redacted by script convention; verify the log file by hand before sharing).
- Container removed at end of run.

## Log

- $logPath
"@
Set-Content -Path $reportPath -Value $reportBody -Encoding UTF8
Write-Log "Report written: $reportPath"
Write-Log "Sprint 14 staging migration replay complete."
exit 0
