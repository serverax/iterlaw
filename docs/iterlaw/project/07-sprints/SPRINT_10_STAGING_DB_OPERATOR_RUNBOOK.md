# Sprint 10 — Staging DB Operator Runbook

**Status:** ACTIVE OPERATOR RUNBOOK.
**Owner:** DB / RAG AIA + the operator.
**Authoritative procedure / appendix:** [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md). This runbook is the **quick-start** version; the long-form checklist holds the full SQL queries, RLS test plan, and §13 sign-off block.

> Sprint 10 code-side migration verification: **PASS**.
> Sprint 10 real staging DB verification: **PENDING** (this runbook).
> Sprint 10 overall: **PARTIAL**.
> Sprint 11: **BLOCKED**.
> Production: **BLOCKED**.

**No agent runs this runbook. The operator runs it.** All commands below are operator-side commands. Each step ends with a PASS / PARTIAL / FAIL gate.

---

## Pre-flight

You will need:

- A confirmed **dev / staging** Postgres DSN (NOT production).
- `psql` on PATH (see §1).
- `pg_dump` on PATH (used for the pre-apply snapshot — see §4).
- This repo checked out locally at `C:\Users\kalsh\projects\iterlaw`.
- A non-production kubectl context (optional — AKS context observed locally is production-only).

Do **not** start until all of the above are confirmed.

---

## §1 — Verify / install `psql` on Windows

### Verify

```powershell
where.exe psql
psql --version
```

If both succeed and `psql --version` shows 14.x or 16.x, you are done. Else install.

### Install (Windows)

Two acceptable paths. Pick one. Do not mix.

**Option A — EnterpriseDB installer (recommended for parity with prod).**

1. Download the matching server / client installer from `https://www.enterprisedb.com/downloads/postgres-postgresql-downloads`.
2. Install **client tools only** if the dev / staging Postgres is remote.
3. Add `C:\Program Files\PostgreSQL\<version>\bin` to your `PATH`.
4. Re-open the shell; re-run `where.exe psql` and `psql --version`.

**Option B — Chocolatey.**

```powershell
# Requires an elevated PowerShell.
choco install postgresql --params '/Password:NOT-FOR-PROD-LOCAL-ONLY' -y
where.exe psql
psql --version
```

### Gate

| Outcome | Status |
| --- | --- |
| `psql --version` prints a 14.x / 16.x line | **PASS** (proceed to §2). |
| `psql` not found | **FAIL** (install, then re-run). Do not proceed without `psql`. |

---

## §2 — Set `STAGING_DATABASE_URL` safely (no echo, no commit)

Two rules:

1. **Never paste the DSN into a Markdown file, commit message, chat, or log.**
2. **Never echo the variable in a shell that records history.**

### PowerShell — session-scoped, not persisted

```powershell
# Prompt for the DSN; input is hidden.
$secure = Read-Host -AsSecureString "Enter STAGING_DATABASE_URL"
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$env:STAGING_DATABASE_URL = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
```

Verify the variable is set **without printing it**:

```powershell
if ($env:STAGING_DATABASE_URL) { "STAGING_DATABASE_URL: set" } else { "STAGING_DATABASE_URL: NOT SET" }
```

### Bash / Git Bash — session-scoped, not persisted

```bash
# Reads the DSN with no echo and no history capture.
read -rs -p "Enter STAGING_DATABASE_URL: " STAGING_DATABASE_URL
export STAGING_DATABASE_URL
echo
[ -n "$STAGING_DATABASE_URL" ] && echo "STAGING_DATABASE_URL: set" || echo "STAGING_DATABASE_URL: NOT SET"
```

### Forbidden

- `echo $env:STAGING_DATABASE_URL` / `echo $STAGING_DATABASE_URL`
- `Write-Host $env:STAGING_DATABASE_URL`
- Pasting the DSN into a `.env` committed to git.
- Storing the DSN in PowerShell history (`Get-PSReadLineOption | select HistorySavePath`).
- Storing the DSN in `~/.bash_history`. If accidentally typed inline, run:
  ```bash
  unset HISTFILE
  history -c
  ```
  and re-open the shell.

### Gate

| Outcome | Status |
| --- | --- |
| Variable set in current session only; no commit / log carries the value | **PASS**. |
| Variable echoed to terminal / log / commit | **FAIL** — rotate the DSN and start over. |

---

## §3 — Confirm the target is staging / dev, NOT production

Run a hostname + role probe **before** any apply.

```powershell
psql "$env:STAGING_DATABASE_URL" -A -t -c "
SELECT
  current_database()                                                   AS db_name,
  inet_server_addr()::text                                             AS server_ip,
  current_setting('cluster_name', true)                                AS cluster_name,
  current_user                                                         AS db_user,
  (current_setting('iterlaw.environment', true))                       AS app_env;
"
```

A staging / dev DSN should return one of: a clearly-named non-prod database (`iterlaw_staging`, `iterlaw_dev`), a private / non-public `server_ip`, a non-empty `cluster_name` that does **not** contain `prod`, and (if the operator has set it) `app_env = 'staging'` or `'dev'`.

### Forbid

- `db_name` containing `prod`, `production`, or matching the known production DB name.
- `cluster_name` containing `prod`, `production`, `aks-iterlaw-we-prod`, or any known production cluster.
- The DSN host being the public production endpoint.

### Gate

| Outcome | Status |
| --- | --- |
| All four fields confirm non-production | **PASS** (proceed to §4). |
| Any field smells like production | **FAIL** — STOP. Unset the variable, re-prompt, escalate to operator. |

---

## §4 — Pre-apply snapshot + apply migrations 104, 105, 106 in order

### Take a snapshot first (required)

```powershell
$ts = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
pg_dump --format=custom --no-owner --no-acl `
  --file "reports/ITERLAW_STAGING_DUMP_$ts.dump" `
  "$env:STAGING_DATABASE_URL"
```

If `pg_dump` fails, **stop**. Do not apply migrations without a recoverable dump.

### Apply migrations

Apply in **strict order**. Each must finish before the next starts. `ON_ERROR_STOP=1` makes partial application impossible.

```powershell
$mig = "apps\legal-orchestrator\db\migrations"

psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$mig\104_user_workspace_foundation.sql"
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$mig\105_case_workspace.sql"
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$mig\106_enable_rls.sql"
```

Capture every output line into a log file (no DSN in the log):

```powershell
$applyLog = "reports/ITERLAW_SPRINT_10_STAGING_APPLY_$(Get-Date -Format yyyy-MM-dd).log"
# (run each psql command with `*> $applyLog -Append` if PowerShell, or `| tee -a "$applyLog"` if bash).
```

### Gate

| Outcome | Status |
| --- | --- |
| All three migrations exit 0; log captured to `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log` | **PASS** (proceed to §5). |
| Any migration exits non-zero | **FAIL** — STOP, restore from the §4 dump, file an issue, escalate. Do **not** retry without a fix. |

---

## §5 — Verify extensions

The corpus + user-data chain assumes `pgcrypto`, `vector` (pgvector), `pg_trgm`, and `unaccent`. Verify each is installed:

```sql
SELECT extname, extversion
  FROM pg_extension
 WHERE extname IN ('pgcrypto','vector','pg_trgm','unaccent')
 ORDER BY extname;
```

Expected: four rows.

If any are missing:

```sql
-- Run by an account with CREATEDB privilege only on dev / staging.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Gate

| Outcome | Status |
| --- | --- |
| All four extensions present and versions recorded in the apply log | **PASS** (proceed to §6). |
| Any extension missing after `CREATE EXTENSION` | **FAIL** — escalate to operator (privilege issue, not a code issue). |

---

## §6 — Verify tables

### Workspace / user / case tables (from migrations 104, 105)

```sql
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'users','workspaces','workspace_members',
     'legal_case_records','legal_case_facts','legal_case_documents',
     'legal_case_drafts','legal_case_timeline','legal_case_sources'
   )
 ORDER BY table_name;
```

Expected: **9 rows**.

### RAG / source / citation tables (from the earlier 001 – 010 + 102 chain — only verify if already migrated against this DB)

```sql
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'legal_sources','legal_documents','legal_chunks','legal_chunk_embeddings',
     'legal_citations','legal_domains','legal_cases','rag_runs',
     'source_update_log','answer_verification_log','verified_answers_cache'
   )
 ORDER BY table_name;
```

If the corpus chain has been applied to this staging DB, expect every row to appear. If it has **not** (e.g. this is a fresh staging where only 104 / 105 / 106 were applied for a focused test), the missing rows are expected — record this honestly in the apply log as "corpus chain not present on this staging DB".

### Planned-later tables (post-Sprint-10 / Sprint 18+ roadmap — must NOT exist yet)

These are listed in `02-database/DATABASE_SUMMARY.md` §"Future / target tables". They are part of the post-Sprint-10 roadmap and **must not** be present on this staging DB unless a later migration has been applied separately:

```sql
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'platform_countries','platform_modules','user_subscriptions',
     'subscription_events','case_deadlines','question_history',
     'user_loyalty','loyalty_transactions',
     'law_category_modules','law_section_modules',
     'module_qa_cache','answer_generation_queue',
     'human_approval_queue','legal_fact_registry','legal_fact_provenance'
   );
```

Expected for this sprint: **0 rows**. If any appear, record them in the apply log; they do not block Sprint 10 PASS, but they indicate the DB carries roadmap tables that have not been ADR-approved yet — escalate to DB / RAG AIA + Docs AIA review.

### Gate

| Outcome | Status |
| --- | --- |
| 9 / 9 workspace tables; corpus tables present (or honestly recorded as absent); zero planned-later tables | **PASS** (proceed to §7). |
| < 9 workspace tables | **FAIL** — restore from the §4 dump, re-apply, log the mismatch. |
| Planned-later tables present without an approved migration | **PARTIAL** — escalate but do not fail this gate. |

---

## §7 — Verify RLS is **enabled** on the 9 user-data tables and **disabled** on corpus

```sql
SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'r'
   AND (
     (n.nspname = 'public' AND c.relname IN (
       'users','workspaces','workspace_members',
       'legal_case_records','legal_case_facts','legal_case_documents',
       'legal_case_drafts','legal_case_timeline','legal_case_sources'
     ))
     OR (n.nspname = 'public' AND c.relname IN (
       'legal_sources','legal_documents','legal_chunks','legal_cases'
     ))
   )
 ORDER BY n.nspname, c.relname;
```

Expected:

- `rls_enabled = t` for the **9 user-data tables**.
- `rls_enabled = f` for the **4 corpus tables**.

### Gate

| Outcome | Status |
| --- | --- |
| 9 t + 4 f, exactly | **PASS** (proceed to §8). |
| Any user-data table missing RLS, or any corpus table with RLS on | **FAIL** — escalate. RLS misalignment is a release blocker. |

---

## §8 — Verify fail-closed RLS behaviour

RLS must return **zero rows** when the session GUCs are NULL.

```sql
-- Reset any prior session settings.
RESET app.user_id;
RESET app.user_role;
RESET app.workspace_id;

-- These should ALL return 0.
SELECT 'workspaces' AS table_name, count(*) FROM workspaces
UNION ALL
SELECT 'legal_case_records', count(*) FROM legal_case_records
UNION ALL
SELECT 'legal_case_facts', count(*) FROM legal_case_facts
UNION ALL
SELECT 'legal_case_documents', count(*) FROM legal_case_documents
UNION ALL
SELECT 'legal_case_drafts', count(*) FROM legal_case_drafts
UNION ALL
SELECT 'legal_case_timeline', count(*) FROM legal_case_timeline
UNION ALL
SELECT 'legal_case_sources', count(*) FROM legal_case_sources;
```

Each count **must be 0**. A non-zero count = fail-closed contract is broken — that is a hard release blocker.

For the full RLS test cases (user-A-vs-B isolation, solicitor scoping, admin override, child-table inheritance) see the long-form checklist §8 C.1 – C.5.

### Gate

| Outcome | Status |
| --- | --- |
| All counts return 0 + the 5 long-form RLS tests PASS | **PASS** (proceed to §9). |
| Any count > 0, or any long-form RLS test fails | **FAIL** — STOP. Restore from §4 dump. Escalate. |

---

## §9 — Smoke queries

### A. Table counts (with RLS sessionless → counts must be 0; see §8)

The §8 fail-closed test is the count check. Re-run it here and record the result in the apply log.

### B. RLS policy listing

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN (
     'users','workspaces','workspace_members',
     'legal_case_records','legal_case_facts','legal_case_documents',
     'legal_case_drafts','legal_case_timeline','legal_case_sources'
   )
 ORDER BY tablename, policyname;
```

Expected: a set of policies aligned with the helpers from migration 106 (`current_app_user_id()`, `current_user_in_workspace`, `current_user_can_write_workspace`, `current_user_can_write_case`, `current_app_user_is_admin`). Roughly **17 policies** across the 9 tables. Exact counts per table are documented in `apps/legal-orchestrator/db/migrations/106_enable_rls.sql`.

### C. Source registry counts (only if the corpus chain is applied)

```sql
-- Skip if §6's "RAG / source / citation tables" query returned 0 rows.
SELECT
  (SELECT count(*) FROM legal_sources)                AS legal_sources,
  (SELECT count(*) FROM legal_documents)              AS legal_documents,
  (SELECT count(*) FROM legal_chunks)                 AS legal_chunks,
  (SELECT count(*) FROM legal_chunk_embeddings)       AS legal_chunk_embeddings,
  (SELECT count(*) FROM legal_citations)              AS legal_citations,
  (SELECT count(*) FROM legal_cases)                  AS legal_cases;
```

Record the result. Sprint 10 does not require any specific minimum — but if `legal_chunks` is 0 the orchestrator will refuse all questions with `insufficient_sources` at runtime, which is the expected safe-default. Seeding is a separate operator action.

### D. Citation metadata completeness (only if `legal_chunks` is non-empty)

```sql
-- Skip if legal_chunks is empty.
SELECT
  count(*) FILTER (WHERE chunk_id      IS NULL OR chunk_id      = '') AS missing_chunk_id,
  count(*) FILTER (WHERE document_id   IS NULL OR document_id   = '') AS missing_document_id,
  count(*) FILTER (WHERE title         IS NULL OR title         = '') AS missing_title,
  count(*) FILTER (WHERE url           IS NULL OR url           = '') AS missing_url,
  count(*) FILTER (WHERE citation_label IS NULL OR citation_label = '') AS missing_citation_label,
  count(*) AS total
  FROM legal_chunks
 WHERE is_active = true;
```

Each `missing_*` column **must be 0**. Any non-zero value would cause the citation gate to drop rows at runtime — record and escalate.

### E. Fail-closed insert smoke (transaction-only; rollback before commit)

Sanity check that the schema accepts inserts when the session GUCs are set, and that no cross-workspace read is possible. **Do not commit smoke data to staging.**

```sql
-- Pick a deterministic test user + workspace.
SELECT set_config('app.user_id',     '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('app.user_role',   'member',                                true);
SELECT set_config('app.workspace_id','00000000-0000-0000-0000-0000000000aa', true);

-- Insert a case (will fail with policy_violation if the user / workspace row
-- does not exist; in that case the test confirms RLS works on INSERT too).
-- DO NOT use real names. DO NOT use real PII.

BEGIN;
INSERT INTO users (id, email, role)
  VALUES ('00000000-0000-0000-0000-000000000001','smoke-test@example.local','member')
  ON CONFLICT DO NOTHING;
INSERT INTO workspaces (id, owner_user_id, display_name)
  VALUES ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-000000000001','smoke-workspace')
  ON CONFLICT DO NOTHING;
INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-000000000001','owner')
  ON CONFLICT DO NOTHING;

INSERT INTO legal_case_records
  (workspace_id, owner_user_id, primary_issue, status, display_name)
  VALUES
  ('00000000-0000-0000-0000-0000000000aa',
   '00000000-0000-0000-0000-000000000001',
   'unfair_dismissal',
   'intake',
   'smoke-case');

SELECT count(*) FROM legal_case_records WHERE workspace_id = '00000000-0000-0000-0000-0000000000aa';
-- Expected: 1

ROLLBACK;  -- never commit smoke data to staging.
```

Then, immediately after `ROLLBACK`, re-run §8. Counts must all return 0 again.

### Gate

| Outcome | Status |
| --- | --- |
| Insert succeeds inside the transaction; rollback leaves §8 counts at 0 | **PASS** (proceed to §10). |
| Insert fails for a reason other than the deliberate fail-closed contract, or §8 counts non-zero post-rollback | **FAIL** — STOP, escalate. |

---

## §10 — Start `legal-orchestrator` with staging DB configured

In a separate, non-shared terminal:

```powershell
cd C:\Users\kalsh\projects\iterlaw\apps\legal-orchestrator
$env:DATABASE_URL = $env:STAGING_DATABASE_URL
$env:NODE_ENV     = "staging"
$env:LOG_LEVEL    = "info"
$env:ITERLAW_LOCAL_LLM_ENABLED = "false"
$env:ITERLAW_LLM_GATEWAY_MODE  = "disabled"

# Build then start. NEVER print the env in a log file.
npm run build
node dist/server.js
```

The startup banner must show:

- `DATABASE_URL: configured` (string literal, not the value).
- `rag.mode = postgres`.
- `local llm gateway: disabled`.
- No DSN string, no API key, no password anywhere in the banner.

If the startup log prints the DSN, kill the process, rotate the DSN, fix the log code, and re-run.

### Gate

| Outcome | Status |
| --- | --- |
| Service starts, no secret in log, DB-mode banner correct | **PASS** (proceed to §11). |
| Service crashes / secret leak / wrong mode | **FAIL** — STOP, escalate. |

---

## §11 — Verify `/ready` shape

In a second shell (do not stop the running server):

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/ready | Select-Object -ExpandProperty Content
```

The JSON body must include at minimum:

```jsonc
{
  "rag": {
    "mode": "postgres",                            // §11 expected
    "database": "configured"                       // §11 expected
  },
  "legal_safety": {
    "citation_required": true,                     // §11 expected
    "zero_citation_answer_blocked": true           // §11 expected
  },
  "llm": {
    "local_gateway_configured": false,             // Sprint 11 still disabled
    "local_gateway_mode": "disabled",
    "local_gateway_available": false
  }
}
```

The response **must not** contain:

- `DATABASE_URL` or any DSN substring.
- An Ollama base URL.
- Any API key, password, JWT, or PEM block.
- The full file path of the corpus mount.

### Gate

| Outcome | Status |
| --- | --- |
| `/ready` matches the expected shape AND carries no secrets | **PASS** (proceed to §12). |
| Missing field, wrong value, or secret in response | **FAIL** — STOP, escalate. |

---

## §12 — Redact all secrets in logs

Before you save anything to `reports/`:

```powershell
$logPath = "reports/ITERLAW_SPRINT_10_STAGING_APPLY_$(Get-Date -Format yyyy-MM-dd).log"

# Redaction passes (run each in order). Add more patterns if your setup
# emits provider-shaped tokens.
(Get-Content $logPath) `
  -replace 'postgres(?:ql)?://[^\s]+:[^\s]+@[^\s]+', 'postgres://[REDACTED]@[REDACTED]' `
  -replace '(?i)password\s*=\s*[^\s,;]+',           'password=[REDACTED]' `
  -replace '(?i)DATABASE_URL\s*=\s*[^\s]+',         'DATABASE_URL=[REDACTED]' `
  -replace 'ghp_[A-Za-z0-9]{20,}',                  '[REDACTED-GH-PAT]' `
  -replace 'github_pat_[A-Za-z0-9_]{20,}',          '[REDACTED-GH-PAT]' `
  -replace '\bsk-[A-Za-z0-9]{20,}',                 '[REDACTED-PROVIDER-KEY]' `
  -replace '\bAKIA[0-9A-Z]{16}\b',                  '[REDACTED-AKIA]' `
  -replace '\bAIza[0-9A-Za-z_-]{35}\b',             '[REDACTED-GOOG-KEY]' `
  -replace '-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----',
  '[REDACTED-PEM-PRIVATE-KEY]' `
  | Set-Content $logPath
```

Then grep the log to confirm no leak:

```bash
grep -E "postgres(ql)?://|DATABASE_URL=|ghp_|github_pat_|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|BEGIN [A-Z ]*PRIVATE KEY" "$logPath" && echo "LEAK" || echo "CLEAN"
```

Only commit a log file whose grep returns `CLEAN`.

### Gate

| Outcome | Status |
| --- | --- |
| Log redaction grep returns `CLEAN` | **PASS** (proceed to §13). |
| Any leak pattern still matches | **FAIL** — STOP. Rotate the DSN and any leaked credential. Re-redact. |

---

## §13 — PASS / PARTIAL / FAIL criteria

The overall Sprint 10 staging-DB verification gate is:

| Overall | When |
| --- | --- |
| **PASS** | §1 – §12 all return PASS, the redacted log is committed to `reports/`, and the long-form §13 sign-off block from `09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md` is filled in. **Only then** flip the SPRINT_INDEX + project status. |
| **PARTIAL** | Code-side ready (already PASS), staging applied but one of §5 – §11 returned a soft fault (e.g. missing extension installed mid-run, RLS smoke-test inserts blocked because the test user / workspace seed step was skipped). Capture the partial result, log the blocker, escalate. Do **not** flip SPRINT_INDEX to PASS. |
| **FAIL** | Any of §2 (secret leak), §3 (production target detected), §4 (migration error), §7 (RLS misalignment), §8 (fail-closed broken), §10 (service crash / secret leak), §11 (`/ready` secret leak or wrong shape), §12 (redaction grep returns `LEAK`). STOP, restore from the §4 dump, escalate to operator + Security AIA. |

A staging `FAIL` keeps Sprint 10 at **PARTIAL** in the project status. A staging `PASS` is required to move Sprint 10 to **PASS** and to unblock Sprint 11.

---

## After PASS

When (and only when) §13 is `PASS`:

1. Operator completes the §13 sign-off block in the long-form checklist.
2. Operator writes the apply log into `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.
3. Docs AIA updates `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` Sprint 10 row from PARTIAL → PASS, with the date.
4. Docs AIA updates `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` Sprint 10 line from PENDING → PASS (with date and report path).
5. Superior AI Architect AIA reviews Sprint 11 to confirm Phase 2B (live transport) can begin.
6. No production deploy. Production remains **BLOCKED** until the full production-ready evidence set is recorded (see [`../11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md`](../11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md) §"Production Readiness").

---

## Required replay after migration 102 compatibility fix

Commit `c17ffc2 fix(iterlaw): make legal cases migration compatible with legacy schema` added an additive, idempotent ALTER block to `102_add_legal_cases_table.sql`. The previous Docker staging replay failed at `idx_legal_cases_decision_date`. The operator must re-run the full chain after the fix and capture evidence below.

### Replay scope

Replay the full forward chain in numeric order:

```
000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010
→ 100 → 101 → 102 → 104 → 105 → 106
```

(103 is reserved; do not create.)

### Required evidence

- DB target confirmation showing **dev / staging**, not production (re-run §3 of this runbook).
- Migration chain applied in numeric order with `ON_ERROR_STOP=1`.
- Confirmation that 102 completes without `decision_date` / `source_provider` / `source_id` / `metadata` index failure.
- Schema check that `public.legal_cases` includes:
  - `judgment_date`
  - `decision_date`
  - `source_id`
  - `source_provider`
  - `metadata`
  - `case_name`
  - `jurisdiction`
  - `url`
  - `summary`
  - `full_text`
  - `updated_at`
- Index check that the following exist on `public.legal_cases`:
  - `idx_legal_cases_neutral_citation`
  - `idx_legal_cases_court`
  - `idx_legal_cases_decision_date`
  - `idx_legal_cases_source_provider`
  - `idx_legal_cases_source_id`
  - `idx_legal_cases_document_id`
  - `idx_legal_cases_metadata_gin`
  - `idx_legal_cases_judgment_date` (from 100's earlier index — coexists)
- Final replay status `PASS` / `FAIL` captured in `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.
- The §13 sign-off block from `../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md` filled in.

A `PASS` here is the gate that moves Sprint 10 from PARTIAL → PASS and unblocks Sprint 11 Phase 2B.

## Related

- Long-form authoritative checklist: [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md)
- Locked DB decisions: [`SPRINT_10_DB_DECISIONS.md`](SPRINT_10_DB_DECISIONS.md)
- Project status: [`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md)
- Sprint index: [`SPRINT_INDEX.md`](SPRINT_INDEX.md)
- Truth protocol: [`../11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md`](../11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md)
- Naming policy: [`../11-ai-governance/NAMING_CONSISTENCY_POLICY.md`](../11-ai-governance/NAMING_CONSISTENCY_POLICY.md)
- AIA operating model: [`../11-ai-governance/AIA_OPERATING_MODEL.md`](../11-ai-governance/AIA_OPERATING_MODEL.md)
