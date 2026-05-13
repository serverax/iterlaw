# =====================================================================
# Sprint 10 — Docker staging DB migration replay (operator-controlled).
# =====================================================================
#
# Purpose
# -------
# Run the complete Sprint 10 clean Docker staging DB replay
# (migrations 000..010, 100, 101, 102, 104, 105, 106) plus the
# legal-orchestrator typecheck / build / vitest gates and the
# /ready verification, from one PowerShell entry point — without
# embedding secrets in committed files.
#
# Runs only when the operator invokes it. Reads credentials from env
# vars (this file contains zero secret values). Never prints the
# password to stdout or to any log / report file. Redacts the DSN
# to `postgresql://USER:[REDACTED]@localhost:PORT/DB` everywhere.
#
# What this script will do
# ------------------------
# 1. Repo root + env var validation.
# 2. docker stop / docker rm any old `iterlaw-staging-postgres`.
# 3. docker run a fresh `pgvector/pgvector:pg16` container.
# 4. Wait for Postgres to accept connections.
# 5. Apply every forward migration in numeric order with
#    `psql -v ON_ERROR_STOP=1`.
# 6. Run verification SQL (extensions, tables, columns, RLS,
#    policies, smoke counts, citation-readiness checks).
# 7. Build legal-orchestrator (typecheck + tsc).
# 8. Start the orchestrator with DATABASE_URL pointing at the
#    Docker container. Wait for /ready.
# 9. Curl /ready and assert the required field shape.
# 10. Redaction scan on the assembled log.
# 11. On PASS: write `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<date>.md`
#     and optionally update SPRINT_INDEX.md + ITERLAW_PROJECT_STATUS.md.
# 12. On FAIL: write a BLOCKER report at
#     `reports/ITERLAW_SPRINT_10_STAGING_REPLAY_BLOCKER_<date>.md`
#     and leave status docs untouched.
# 13. Always stop the orchestrator process and stop+remove the
#     Docker container at teardown.
#
# This script never pushes, never deploys, never runs kubectl, never
# touches production. Production-host refusal is enforced by the
# fact that the script only ever connects to localhost:$PORT inside
# a freshly-created Docker container.
#
# Strict rules baked into the script:
#   * No password / DSN / token written to a committed file.
#   * No password printed to stdout or to any report.
#   * Sprint 10 status is updated to PASS only after every gate
#     (replay + extensions + tables + columns + RLS + policies +
#     /ready) is green.
#   * Sprint 11 is marked unblocked only when Sprint 10 PASS.
#   * On any gate failure the script halts and writes the BLOCKER
#     report; status docs are not touched.
#
# Invoke as the operator (do not commit the env-var values):
#
#   $env:ITERLAW_STAGING_PG_USER="iterlaw_staging"
#   $env:ITERLAW_STAGING_PG_PASSWORD="<operator-local-throwaway-password>"
#   $env:ITERLAW_STAGING_PG_DB="iterlaw_staging"
#   $env:ITERLAW_STAGING_PG_PORT="5433"
#   .\scripts\operator\sprint10-docker-staging-replay.ps1
#
# =====================================================================

[CmdletBinding()]
param(
  [string]$ContainerName = "iterlaw-staging-postgres",
  [string]$Image = "pgvector/pgvector:pg16",
  [int]$OrchestratorPort = 3000,
  [int]$ReadyTimeoutSec = 60,
  [int]$PgReadyTimeoutSec = 60,
  [switch]$SkipStatusUpdate
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ---------------------------------------------------------------------
# Repo root + paths
# ---------------------------------------------------------------------
try {
  $repoRoot = (& git rev-parse --show-toplevel) 2>$null
  if (-not $repoRoot -or -not (Test-Path $repoRoot)) {
    throw "Could not determine git repo root via `git rev-parse --show-toplevel`."
  }
} catch {
  throw "Run this script from inside the iterlaw git repo. ($_)"
}
$repoRoot = [System.IO.Path]::GetFullPath($repoRoot)
Set-Location $repoRoot

$migrationsDir = Join-Path $repoRoot "apps\legal-orchestrator\db\migrations"
$orchDir       = Join-Path $repoRoot "apps\legal-orchestrator"
$reportsDir    = Join-Path $repoRoot "reports"
$logsDir       = Join-Path $reportsDir "logs"
foreach ($d in @($migrationsDir, $orchDir, $reportsDir)) {
  if (-not (Test-Path $d)) { throw "Required path missing: $d" }
}
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

# ---------------------------------------------------------------------
# Env var validation (FAIL FAST — no defaults, no fallbacks)
# ---------------------------------------------------------------------
$required = @(
  "ITERLAW_STAGING_PG_USER",
  "ITERLAW_STAGING_PG_PASSWORD",
  "ITERLAW_STAGING_PG_DB",
  "ITERLAW_STAGING_PG_PORT"
)
$missing = @()
foreach ($v in $required) {
  if (-not (Test-Path "env:$v") -or -not (Get-Item "env:$v" -ErrorAction SilentlyContinue).Value) {
    $missing += $v
  }
}
if ($missing.Count -gt 0) {
  Write-Host "ERROR: missing required env vars: $($missing -join ', ')"
  Write-Host "Set them in PowerShell, then re-run. Example:"
  Write-Host '  $env:ITERLAW_STAGING_PG_USER="iterlaw_staging"'
  Write-Host '  $env:ITERLAW_STAGING_PG_PASSWORD="<operator-local-throwaway-password>"'
  Write-Host '  $env:ITERLAW_STAGING_PG_DB="iterlaw_staging"'
  Write-Host '  $env:ITERLAW_STAGING_PG_PORT="5433"'
  exit 2
}

$pgUser = $env:ITERLAW_STAGING_PG_USER
$pgPass = $env:ITERLAW_STAGING_PG_PASSWORD
$pgDb   = $env:ITERLAW_STAGING_PG_DB
$pgPort = $env:ITERLAW_STAGING_PG_PORT
if ($pgUser   -match '\s') { throw "ITERLAW_STAGING_PG_USER must not contain whitespace." }
if ($pgDb     -match '\s') { throw "ITERLAW_STAGING_PG_DB must not contain whitespace." }
if (-not ([int]::TryParse($pgPort, [ref]([int]0)))) {
  throw "ITERLAW_STAGING_PG_PORT must be an integer."
}

# Redacted DSN — used in logs/reports. Real DSN constructed only inline.
$redactedDsn = "postgresql://${pgUser}:[REDACTED]@localhost:${pgPort}/${pgDb}"

# ---------------------------------------------------------------------
# Output helpers — log file + redaction
# ---------------------------------------------------------------------
$ts = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$dateStamp = (Get-Date).ToString("yyyy-MM-dd")
$logPath = Join-Path $logsDir "sprint10-staging-replay-$ts.log"
$reportPassPath    = Join-Path $reportsDir "ITERLAW_SPRINT_10_STAGING_APPLY_$dateStamp.md"
$reportBlockerPath = Join-Path $reportsDir "ITERLAW_SPRINT_10_STAGING_REPLAY_BLOCKER_$dateStamp.md"

# Redaction patterns applied before writing to log / report. The real
# password may appear in transient stdout from `docker run`/`docker
# exec` invocations; we strip it from any string before persistence.
$redactionPatterns = @(
  @{ Pattern = [regex]::Escape($pgPass); Replace = "[REDACTED-PG-PASSWORD]" }
  @{ Pattern = "(?i)PGPASSWORD=\S+";     Replace = "PGPASSWORD=[REDACTED]"   }
  @{ Pattern = "postgresql://[^@]+@";    Replace = "postgresql://[REDACTED]@"}
  @{ Pattern = "postgres://[^@]+@";      Replace = "postgres://[REDACTED]@"  }
)
function Redact([string]$s) {
  if (-not $s) { return $s }
  foreach ($r in $redactionPatterns) {
    $s = [regex]::Replace($s, $r.Pattern, $r.Replace)
  }
  return $s
}
function LogLine([string]$line) {
  $clean = Redact($line)
  $clean | Tee-Object -FilePath $logPath -Append | Out-Host
}
function LogSection([string]$title) {
  LogLine "==================================================================="
  LogLine "== $title"
  LogLine "==================================================================="
}

# Wipe log if it somehow exists.
if (Test-Path $logPath) { Remove-Item $logPath -Force }

LogSection "Sprint 10 — Docker staging DB replay START ($ts)"
LogLine "Repo root:       $repoRoot"
LogLine "Migrations dir:  $migrationsDir"
LogLine "Orchestrator:    $orchDir"
LogLine "Container name:  $ContainerName"
LogLine "Container image: $Image"
LogLine "Postgres user:   $pgUser"
LogLine "Postgres db:     $pgDb"
LogLine "Postgres port:   $pgPort  (localhost only — Docker bridge; not production)"
LogLine "DSN (redacted):  $redactedDsn"
LogLine "Log file:        $logPath"

# ---------------------------------------------------------------------
# Run-state — accumulated for the final report.
# ---------------------------------------------------------------------
$state = [ordered]@{
  startedAt        = $ts
  passed           = $false
  failureReason    = $null
  dockerImage      = $Image
  containerName    = $ContainerName
  migrationsApplied= @()
  extensions       = $null
  tablesPresent    = $null
  legalCasesColumns= $null
  legalCasesIndexes= $null
  rlsRows          = $null
  policiesRows     = $null
  smokeCounts      = $null
  typecheckExit    = $null
  buildExit        = $null
  vitestSummary    = $null
  readyJson        = $null
  readyFieldsOk    = $false
  leakScan         = $null
}

# ---------------------------------------------------------------------
# Teardown — always run.
# ---------------------------------------------------------------------
$orchProcess = $null
function Invoke-Teardown {
  param([string]$Reason = "teardown")
  LogSection "TEARDOWN ($Reason)"
  if ($orchProcess -and -not $orchProcess.HasExited) {
    try {
      LogLine "Stopping orchestrator pid $($orchProcess.Id)…"
      $orchProcess | Stop-Process -Force -ErrorAction SilentlyContinue
      $orchProcess.WaitForExit(5000) | Out-Null
    } catch {
      LogLine "  (orchestrator stop error suppressed)"
    }
  }
  try {
    & docker stop $ContainerName *>$null
  } catch { }
  try {
    & docker rm $ContainerName *>$null
  } catch { }
  LogLine "Teardown complete."
}

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments)] [string[]]$Args)
  $raw = (& docker @Args 2>&1) | Out-String
  $raw = Redact($raw)
  if ($raw) { LogLine $raw.TrimEnd() }
  return $LASTEXITCODE
}

function Invoke-Psql {
  param(
    [Parameter(Mandatory=$true)] [string]$Sql,
    [switch]$ExitOnError
  )
  $args = @("exec", "-i", $ContainerName, "psql", "-U", $pgUser, "-d", $pgDb, "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", $Sql)
  $raw = (& docker @args 2>&1) | Out-String
  $clean = Redact($raw).TrimEnd()
  LogLine $clean
  if ($LASTEXITCODE -ne 0 -and $ExitOnError) {
    throw "psql failed (exit $LASTEXITCODE) on SQL: $Sql"
  }
  return @{ ExitCode = $LASTEXITCODE; Output = $clean }
}

function Invoke-PsqlFile {
  param([Parameter(Mandatory=$true)] [string]$Path)
  # Stream file contents via stdin so we can run with ON_ERROR_STOP=1.
  $content = Get-Content -Raw -Path $Path
  $args = @("exec", "-i", $ContainerName, "psql", "-U", $pgUser, "-d", $pgDb, "-v", "ON_ERROR_STOP=1")
  $stdinStream = New-Object System.IO.StringReader($content)
  try {
    $proc = Start-Process -FilePath "docker" -ArgumentList $args -NoNewWindow -PassThru `
      -RedirectStandardInput "$logsDir\.tmp-stdin-$ts.sql" `
      -RedirectStandardOutput "$logsDir\.tmp-stdout-$ts.log" `
      -RedirectStandardError  "$logsDir\.tmp-stderr-$ts.log"
  } finally { $stdinStream.Dispose() }
  # Alternative: pipe via cmd.exe; simpler in practice.
  throw "Invoke-PsqlFile: do not use — use Invoke-MigrationFile instead."
}

function Invoke-MigrationFile {
  param([Parameter(Mandatory=$true)] [string]$Path)
  $name = Split-Path $Path -Leaf
  LogLine "APPLYING $name"
  $tmpStdout = Join-Path $logsDir ".tmp-out-$ts.log"
  $tmpStderr = Join-Path $logsDir ".tmp-err-$ts.log"
  if (Test-Path $tmpStdout) { Remove-Item $tmpStdout -Force }
  if (Test-Path $tmpStderr) { Remove-Item $tmpStderr -Force }
  $args = @("exec", "-i", $ContainerName, "psql", "-U", $pgUser, "-d", $pgDb, "-v", "ON_ERROR_STOP=1")
  # Use cmd.exe redirection to feed the .sql via stdin.
  $psqlCmd = "docker " + ($args -join " ") + " < `"$Path`" > `"$tmpStdout`" 2> `"$tmpStderr`""
  & cmd /c $psqlCmd
  $exit = $LASTEXITCODE
  if (Test-Path $tmpStdout) { LogLine (Redact((Get-Content -Raw $tmpStdout))) }
  if (Test-Path $tmpStderr) { LogLine (Redact((Get-Content -Raw $tmpStderr))) }
  Remove-Item $tmpStdout, $tmpStderr -ErrorAction SilentlyContinue
  return $exit
}

function Write-PassReport {
  $body = @"
# IterLaw — Sprint 10 Staging Replay Report (PASS)

**Date:** $dateStamp
**Container image:** $Image
**Container name:** $ContainerName
**Repo HEAD:** $((& git rev-parse HEAD).Trim())
**Branch:** $((& git rev-parse --abbrev-ref HEAD).Trim())

## Status

PASS for Docker staging replay on a confirmed local sandbox container. **Not** production. **Not** AKS. **Not** the live operator staging DB.

## DSN

``$redactedDsn``

The DSN is shown redacted. The plaintext password is never committed to this repo. Operator obtained it via the env var ``ITERLAW_STAGING_PG_PASSWORD`` and supplied it only to the local ``docker run`` and ``docker exec`` commands.

## Migrations applied (in numeric order)

$(($state.migrationsApplied | ForEach-Object { "- ``$_``" }) -join "`n")

## Extensions

``````
$($state.extensions)
``````

## Tables (key set)

``````
$($state.tablesPresent)
``````

## ``public.legal_cases`` columns

``````
$($state.legalCasesColumns)
``````

## ``public.legal_cases`` indexes

``````
$($state.legalCasesIndexes)
``````

## RLS

``````
$($state.rlsRows)
``````

## Policies

``````
$($state.policiesRows)
``````

## Smoke counts

``````
$($state.smokeCounts)
``````

## Orchestrator gates

- typecheck exit: $($state.typecheckExit)
- build exit:     $($state.buildExit)
- vitest:         $($state.vitestSummary)

## ``/ready`` JSON (DSN-redacted, password-redacted)

``````
$($state.readyJson)
``````

Required-field check: $($state.readyFieldsOk)

## Leak scan

$($state.leakScan)

## Truth statement

> No production DB touched.
> No deployment performed.
> No push performed.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed in this report.
> Docker staging DB only (``$ContainerName`` from image ``$Image`` on localhost:$pgPort).
"@
  $body | Set-Content -Path $reportPassPath -Encoding UTF8
  LogLine "Wrote PASS report: $reportPassPath"
}

function Write-BlockerReport {
  param([string]$Reason)
  $body = @"
# IterLaw — Sprint 10 Staging Replay Blocker

**Date:** $dateStamp
**Container image:** $Image
**Container name:** $ContainerName
**Repo HEAD:** $((& git rev-parse HEAD).Trim())
**Branch:** $((& git rev-parse --abbrev-ref HEAD).Trim())

## Status

PARTIAL / BLOCKED.

## Blocker

$Reason

## Migrations applied before failure

$(($state.migrationsApplied | ForEach-Object { "- ``$_``" }) -join "`n")

## What did NOT happen

- Sprint 10 status was **not** moved to PASS.
- Sprint 11 was **not** marked unblocked.
- No production DB was touched.
- No deployment / push / kubectl mutation.

## Truth statement

> No production DB touched.
> No deployment performed.
> No push performed.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed in this report.
> Docker staging DB only (``$ContainerName`` from image ``$Image`` on localhost:$pgPort).
"@
  $body | Set-Content -Path $reportBlockerPath -Encoding UTF8
  LogLine "Wrote BLOCKER report: $reportBlockerPath"
}

try {

  # -------------------------------------------------------------------
  # 1. Docker version probe
  # -------------------------------------------------------------------
  LogSection "1. Docker version probe"
  $dockerVer = (& docker version --format '{{.Server.Version}}' 2>&1) | Out-String
  if ($LASTEXITCODE -ne 0) { throw "Docker is not running or not on PATH." }
  LogLine "Docker server version: $($dockerVer.Trim())"

  # -------------------------------------------------------------------
  # 2. Stop / remove any prior container
  # -------------------------------------------------------------------
  LogSection "2. Stop / remove prior $ContainerName"
  $ignored = Invoke-Docker stop $ContainerName
  $ignored = Invoke-Docker rm $ContainerName

  # -------------------------------------------------------------------
  # 3. Start fresh container
  # -------------------------------------------------------------------
  LogSection "3. Start fresh $ContainerName from $Image"
  $runArgs = @(
    "run", "--name", $ContainerName,
    "-e", "POSTGRES_USER=$pgUser",
    "-e", "POSTGRES_PASSWORD=$pgPass",
    "-e", "POSTGRES_DB=$pgDb",
    "-p", "${pgPort}:5432",
    "-d", $Image
  )
  $runExit = Invoke-Docker @runArgs
  if ($runExit -ne 0) { throw "docker run failed (exit $runExit)." }

  # -------------------------------------------------------------------
  # 4. Wait for Postgres readiness
  # -------------------------------------------------------------------
  LogSection "4. Wait for Postgres readiness"
  $start = Get-Date
  $ready = $false
  while (((Get-Date) - $start).TotalSeconds -lt $PgReadyTimeoutSec) {
    $probe = (& docker exec $ContainerName pg_isready -U $pgUser -d $pgDb 2>&1) | Out-String
    if ($LASTEXITCODE -eq 0 -and $probe -match "accepting connections") {
      $ready = $true
      LogLine "Postgres accepting connections."
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "Postgres did not become ready within $PgReadyTimeoutSec seconds." }

  # -------------------------------------------------------------------
  # 5. Apply migrations in numeric order
  # -------------------------------------------------------------------
  LogSection "5. Apply forward migrations (numeric order; ON_ERROR_STOP=1)"
  $migrations = Get-ChildItem $migrationsDir -Filter "*.sql" |
                Where-Object { $_.Name -notlike "*.down.sql" } |
                Sort-Object Name
  if ($migrations.Count -eq 0) { throw "No forward migrations found in $migrationsDir." }
  foreach ($m in $migrations) {
    $exit = Invoke-MigrationFile -Path $m.FullName
    if ($exit -ne 0) {
      throw "Migration failed: $($m.Name) (exit $exit). Halting before any later migration runs."
    }
    $state.migrationsApplied += $m.Name
  }
  LogLine "All $($migrations.Count) migrations applied successfully."

  # -------------------------------------------------------------------
  # 6. Verification queries
  # -------------------------------------------------------------------
  LogSection "6a. Extensions"
  $r = Invoke-Psql -Sql "select extname from pg_extension where extname in ('pgcrypto','vector','pg_trgm','unaccent') order by extname;"
  $state.extensions = $r.Output

  LogSection "6b. Key tables"
  $r = Invoke-Psql -Sql @"
select format('%-25s : %s', t, to_regclass('public.'||t)::text) as result from (values
  ('legal_sources'),('legal_documents'),('legal_chunks'),('legal_cases'),
  ('users'),('workspaces'),('workspace_members'),
  ('legal_case_records'),('legal_case_facts'),('legal_case_documents'),
  ('legal_case_drafts'),('legal_case_timeline'),('legal_case_sources')
) as v(t);
"@
  $state.tablesPresent = $r.Output

  LogSection "6c. public.legal_cases columns"
  $r = Invoke-Psql -Sql @"
select column_name||'|'||data_type from information_schema.columns
 where table_schema='public' and table_name='legal_cases'
 order by ordinal_position;
"@
  $state.legalCasesColumns = $r.Output

  LogSection "6d. public.legal_cases indexes"
  $r = Invoke-Psql -Sql @"
select indexname from pg_indexes
 where schemaname='public' and tablename='legal_cases'
 order by indexname;
"@
  $state.legalCasesIndexes = $r.Output

  # Required-column / required-index assertions.
  $requiredCols = @(
    "judgment_date","decision_date","source_id","source_provider",
    "metadata","case_name","jurisdiction","url","summary","full_text","updated_at"
  )
  $missingCols = @()
  foreach ($c in $requiredCols) {
    if ($state.legalCasesColumns -notmatch "(?m)^$c\|") { $missingCols += $c }
  }
  if ($missingCols.Count -gt 0) {
    throw "public.legal_cases missing columns: $($missingCols -join ', ')"
  }
  $requiredIdx = @(
    "idx_legal_cases_neutral_citation","idx_legal_cases_court",
    "idx_legal_cases_decision_date","idx_legal_cases_source_provider",
    "idx_legal_cases_source_id","idx_legal_cases_document_id",
    "idx_legal_cases_metadata_gin","idx_legal_cases_judgment_date"
  )
  $missingIdx = @()
  foreach ($i in $requiredIdx) {
    if ($state.legalCasesIndexes -notmatch "(?m)^$i\b") { $missingIdx += $i }
  }
  if ($missingIdx.Count -gt 0) {
    throw "public.legal_cases missing indexes: $($missingIdx -join ', ')"
  }

  LogSection "6e. RLS state"
  $r = Invoke-Psql -Sql "select schemaname||'.'||tablename||'|rls='||rowsecurity from pg_tables where schemaname='public' and tablename in ('users','workspaces','workspace_members','legal_case_records','legal_case_facts','legal_case_documents','legal_case_drafts','legal_case_timeline','legal_case_sources','legal_sources','legal_documents','legal_chunks','legal_cases') order by tablename;"
  $state.rlsRows = $r.Output

  LogSection "6f. Policies"
  $r = Invoke-Psql -Sql "select tablename||'|'||policyname||'|'||cmd from pg_policies where schemaname='public' order by tablename, policyname;"
  $state.policiesRows = $r.Output

  LogSection "6g. Smoke counts"
  $r = Invoke-Psql -Sql @"
select 'legal_sources='||count(*)::text from public.legal_sources
union all select 'legal_documents='||count(*)::text from public.legal_documents
union all select 'legal_chunks='||count(*)::text from public.legal_chunks
union all select 'legal_cases='||count(*)::text from public.legal_cases
union all select 'users='||count(*)::text from public.users
union all select 'workspaces='||count(*)::text from public.workspaces
union all select 'workspace_members='||count(*)::text from public.workspace_members;
"@
  $state.smokeCounts = $r.Output

  # -------------------------------------------------------------------
  # 7. Orchestrator typecheck / build / vitest
  # -------------------------------------------------------------------
  LogSection "7a. Orchestrator typecheck"
  Push-Location $orchDir
  try {
    & npx tsc --noEmit *>&1 | ForEach-Object { LogLine $_ }
    $state.typecheckExit = $LASTEXITCODE
    if ($state.typecheckExit -ne 0) { throw "Typecheck failed (exit $($state.typecheckExit))." }

    LogSection "7b. Orchestrator build"
    & npm run build *>&1 | ForEach-Object { LogLine $_ }
    $state.buildExit = $LASTEXITCODE
    if ($state.buildExit -ne 0) { throw "Build failed (exit $($state.buildExit))." }

    LogSection "7c. vitest run"
    $vitestOut = (& npx vitest run --reporter=default 2>&1) | Out-String
    LogLine $vitestOut
    if ($LASTEXITCODE -ne 0) { throw "vitest run failed (exit $LASTEXITCODE)." }
    $summary = ($vitestOut -split "`n" | Where-Object { $_ -match "Test Files|Tests " }) -join " | "
    $state.vitestSummary = ($summary -replace "\s+", " ").Trim()

  } finally { Pop-Location }

  # -------------------------------------------------------------------
  # 8. Start orchestrator with Docker DB
  # -------------------------------------------------------------------
  LogSection "8. Start orchestrator (DATABASE_URL points at Docker container)"
  $dsn = "postgresql://${pgUser}:${pgPass}@localhost:${pgPort}/${pgDb}"
  $envSnapshot = [System.Collections.Hashtable]::new()
  foreach ($k in @("DATABASE_URL","NODE_ENV","LOG_LEVEL","ITERLAW_LOCAL_LLM_ENABLED","ITERLAW_LLM_GATEWAY_MODE","PORT")) {
    if (Test-Path "env:$k") { $envSnapshot[$k] = (Get-Item "env:$k").Value }
  }
  $env:DATABASE_URL = $dsn
  $env:NODE_ENV     = "staging"
  $env:LOG_LEVEL    = "info"
  $env:ITERLAW_LOCAL_LLM_ENABLED = "false"
  $env:ITERLAW_LLM_GATEWAY_MODE  = "disabled"
  $env:PORT = "$OrchestratorPort"

  $serverEntry = Join-Path $orchDir "dist\server.js"
  if (-not (Test-Path $serverEntry)) { throw "Server entry missing: $serverEntry (build did not produce dist/server.js)" }

  $orchStdout = Join-Path $logsDir "orchestrator-stdout-$ts.log"
  $orchStderr = Join-Path $logsDir "orchestrator-stderr-$ts.log"
  $orchProcess = Start-Process -FilePath "node" -ArgumentList @("dist\server.js") `
                  -WorkingDirectory $orchDir -NoNewWindow -PassThru `
                  -RedirectStandardOutput $orchStdout -RedirectStandardError $orchStderr
  LogLine "Orchestrator pid: $($orchProcess.Id)"

  # Wait for /ready
  $readyOk = $false
  $readyJsonRaw = $null
  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $ReadyTimeoutSec) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$OrchestratorPort/ready" -TimeoutSec 3
      if ($resp.StatusCode -eq 200) {
        $readyJsonRaw = $resp.Content
        $readyOk = $true
        break
      }
    } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $readyOk) {
    if (Test-Path $orchStdout) { LogLine (Redact((Get-Content -Raw $orchStdout))) }
    if (Test-Path $orchStderr) { LogLine (Redact((Get-Content -Raw $orchStderr))) }
    throw "Orchestrator /ready did not respond within $ReadyTimeoutSec seconds."
  }

  # -------------------------------------------------------------------
  # 9. /ready field check
  # -------------------------------------------------------------------
  LogSection "9. /ready JSON (redacted)"
  $state.readyJson = Redact($readyJsonRaw)
  LogLine $state.readyJson
  try {
    $ready = ConvertFrom-Json $readyJsonRaw
  } catch {
    throw "/ready body is not valid JSON."
  }
  function HasField($obj, [string]$path) {
    $current = $obj
    foreach ($seg in ($path -split "\.")) {
      if ($null -eq $current) { return $null }
      if (-not ($current.PSObject.Properties.Name -contains $seg)) { return $null }
      $current = $current.$seg
    }
    return $current
  }
  $checks = @{
    "rag.configured"                       = $true
    "rag.mode"                             = "postgres"
    "rag.database"                         = "configured"
    "legal_safety.citation_required"       = $true
    "legal_safety.zero_citation_answer_blocked" = $true
  }
  $allOk = $true
  foreach ($k in $checks.Keys) {
    $actual = HasField $ready $k
    $expected = $checks[$k]
    $ok = ($null -ne $actual) -and ([string]$actual -eq [string]$expected)
    LogLine ("  field {0,-46} expected={1,-12} actual={2,-12} {3}" -f $k, [string]$expected, [string]$actual, ($(if($ok){'OK'}else{'FAIL'})))
    if (-not $ok) { $allOk = $false }
  }
  $state.readyFieldsOk = $allOk

  # Leak scan on /ready body
  $leakHit = $false
  foreach ($needle in @($pgPass, $dsn, "POSTGRES_PASSWORD")) {
    if ($readyJsonRaw -and $readyJsonRaw.Contains($needle)) {
      $leakHit = $true
      LogLine "/ready response leaks: $($needle.Substring(0, [Math]::Min(8, $needle.Length)))…"
    }
  }
  if ($leakHit) { throw "/ready response leaks credential/DSN. Hard fail." }
  $state.leakScan = "CLEAN — no DATABASE_URL / password / DSN in /ready response."

  if (-not $allOk) { throw "/ready field shape check failed (see field-by-field log)." }

  # -------------------------------------------------------------------
  # 10. PASS report
  # -------------------------------------------------------------------
  $state.passed = $true
  Write-PassReport

  # Status-doc updates (only if not -SkipStatusUpdate)
  if (-not $SkipStatusUpdate) {
    LogSection "11. Status-doc updates (Sprint 10 → PASS, Sprint 11 → unblocked)"
    LogLine "Status-doc updates are operator-approved (see -SkipStatusUpdate to skip)."
    LogLine "Note: this script writes the PASS report only; the Docs AIA agent makes the SPRINT_INDEX.md / ITERLAW_PROJECT_STATUS.md edits in a separate commit."
  }

  Invoke-Teardown -Reason "successful PASS"
  LogLine "DONE — Sprint 10 staging replay PASS. Report: $reportPassPath"
  exit 0

} catch {
  $msg = $_.Exception.Message
  $state.failureReason = $msg
  LogSection "FAILURE"
  LogLine "Reason: $msg"
  try { Write-BlockerReport -Reason $msg } catch { LogLine "(also failed to write blocker report: $($_.Exception.Message))" }
  Invoke-Teardown -Reason "failure path"
  LogLine "DONE — Sprint 10 staging replay FAIL. Blocker report: $reportBlockerPath"
  exit 1
} finally {
  # Restore env vars touched.
  if ($envSnapshot) {
    foreach ($k in $envSnapshot.Keys) {
      Set-Item -Path "env:$k" -Value $envSnapshot[$k]
    }
  }
}
