# IterLaw — Sprint 10 DB Implementation QA Report

**Date:** 2026-05-12
**AIA on duty:** Database Architecture AIA (single assigned AIA)
**Repo:** `C:\Users\kalsh\projects\iterlaw`
**Final status:** **PASS** (static + repo gates green; live DB NOT EXECUTED per standing rule)

---

## 0. Numbering reconciliation (important)

The task brief referenced `SPRINT10-102-LEGAL-CASES-FOUNDATION.ts` and `SPRINT10-103-LEGAL-CASES-RLS.ts`. Those `.ts` files **do not exist in this repo** — they appear to be artefacts from an external sandbox (`/mnt/project/`-prefixed paths in an earlier handoff). Two facts are independent of the brief:

1. **`102_add_legal_cases_table.sql` already exists and is the corpus `legal_cases` migration** — shipped in commit `0f0697a` during Sprint 9 cleanup. The standing rule "Do not modify existing migrations 001-101 unless a clear defect is found" applies; the brief's own rule also says "Do not modify existing migrations 001-101". 102 is in that range by extension (its content is corpus case-law, immutable for this sprint).
2. **The previous owner decision (this conversation, the immediately preceding turn) authorised 104/105/106** as the numbers for the user/workspace + case-workspace + RLS block, with 103 reserved for future GraphRAG (AI Architect AIA scope).

This QA report therefore documents the work landed at **104/105/106**, which is the same Sprint 10 user-data foundation the external sandbox proposed at 102/103. Names map as follows:

| External proposal | This repo |
| --- | --- |
| `SPRINT10-102-LEGAL-CASES-FOUNDATION.ts` (user + workspace + cases + timeline + sources) | Split into `104_user_workspace_foundation.sql` + `105_case_workspace.sql` |
| `SPRINT10-103-LEGAL-CASES-RLS.ts` (RLS) | `106_enable_rls.sql` |

The split is deliberate — landing user/workspace foundation before case-workspace allows safe rollback at table granularity.

---

## 1. Files added / modified

### New migrations (6 SQL files)

| File | Lines | Purpose |
| --- | --- | --- |
| `apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.sql` | 178 | `users`, `workspaces`, `workspace_members` + indexes + FKs + CHECK constraints |
| `apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.down.sql` | 12 | DROP in reverse-FK order |
| `apps/legal-orchestrator/db/migrations/105_case_workspace.sql` | 366 | 6 case-workspace tables (`legal_case_records`, `legal_case_facts`, `legal_case_documents`, `legal_case_drafts`, `legal_case_timeline`, `legal_case_sources`) |
| `apps/legal-orchestrator/db/migrations/105_case_workspace.down.sql` | 9 | DROP in reverse-FK order |
| `apps/legal-orchestrator/db/migrations/106_enable_rls.sql` | 235 | 6 RLS helper functions + RLS ENABLE + ~17 policies |
| `apps/legal-orchestrator/db/migrations/106_enable_rls.down.sql` | 48 | DROP every policy + DISABLE RLS + DROP helpers |

### New tests (3 vitest files)

| File | Tests |
| --- | --- |
| `apps/legal-orchestrator/src/tests/migrationSprint13UserWorkspace.test.ts` | 20 |
| `apps/legal-orchestrator/src/tests/migrationSprint13CaseWorkspace.test.ts` | 31 |
| `apps/legal-orchestrator/src/tests/migrationSprint13Rls.test.ts` | 44 |

Total new tests: **95**. (file naming uses "Sprint13" because the migrations are a Sprint-13 prerequisite — they are produced now but apply when Sprint 13 needs them).

### Modified files

| File | Change |
| --- | --- |
| `scripts/infra/verify-iterlaw-rag-db.sh` | Added 104/105/106 static checks (presence, destructive-SQL, secrets, RLS scope) + live-DB checks for the new tables. |
| `docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md` | Added 104/105/106 to the migration table + updated the recommended apply order. |

---

## 2. Migration convention found

- **Format:** `.sql` (psql-executable). The Sprint 10 brief mentioned `.ts` migration files; this repo does NOT use `.ts` migrations anywhere. The 103/104/105/106 work landed as `.sql` to match the existing convention.
- **Naming:** `NNN_descriptive_snake_case.sql` + matching `NNN_descriptive_snake_case.down.sql` where rollback is supported.
- **Idempotency:** Every `CREATE TABLE` uses `IF NOT EXISTS`; every `CREATE INDEX` uses `IF NOT EXISTS`; every FK constraint is added via `DO $$ IF NOT EXISTS (SELECT FROM pg_constraint …) THEN ALTER TABLE … ADD CONSTRAINT … END IF; $$`; every RLS policy is created behind a `pg_policies` existence check. Re-running any migration is a no-op.
- **Destructive contract:** approved-chain migrations carry zero `DROP TABLE`, zero `TRUNCATE`, zero `DELETE FROM`, zero `ALTER TABLE … DROP COLUMN/RENAME`. The only `ALTER … DROP CONSTRAINT` in the chain is a standard idempotent CHECK-widening guard in `002_*`.

Conversion of the external `.ts` proposal to `.sql` was therefore **required and performed**.

---

## 3. Schema objects created

### 104 — user/workspace foundation

| Table | Rows owns |
| --- | --- |
| `public.users` | IterLaw user record (email, optional auth_provider/external_subject, status). RLS-eligible. |
| `public.workspaces` | Tenant container. `workspace_type` ∈ {individual, team, organisation, admin}. |
| `public.workspace_members` | Role-bearing membership. `role` ∈ {owner, admin, editor, viewer, solicitor}; `status` ∈ {active, invited, suspended, removed}. UNIQUE(workspace_id, user_id). |

CHECK constraints lock the role / status / workspace_type taxonomy. FK constraints with `ON DELETE CASCADE` from `workspace_members` to both parents, `ON DELETE SET NULL` from `workspaces.owner_user_id`.

### 105 — case workspace (USER side)

| Table | Purpose |
| --- | --- |
| `public.legal_case_records` | User's IterLaw case (parent). 17-value `primary_issue` CHECK, 15-value `status` CHECK. Carries `workspace_id`, `owner_user_id`, `assigned_user_id`, dates (employment_start/end, dismissal, ACAS, tribunal_deadline). |
| `public.legal_case_facts` | Structured facts (key/value + confidence + user_confirmed). UNIQUE(case_id, fact_key). |
| `public.legal_case_documents` | Uploaded documents (contract, dismissal letter, payslip, …). 16-value `document_type` CHECK. Storage URI is logical; binary lives off-DB. Carries `retention_expires_at` for retention enforcement. |
| `public.legal_case_drafts` | Generated drafts (grievance/appeal/ACAS/tribunal notes). 8-value `draft_type` CHECK. |
| `public.legal_case_timeline` | **USER-WORKSPACE timeline** (not the corpus case-law timeline). 15-value `event_type` CHECK covering user events, document upload/extraction, employer/employee communication, ACAS / grievance / disciplinary / appeal / settlement / tribunal events, deadline reminders, system checkpoints. |
| `public.legal_case_sources` | **JOIN table** between user case and corpus rows. References `legal_sources` / `legal_documents` / `legal_chunks` / `legal_cases` via nullable FKs `ON DELETE SET NULL` (citation history survives corpus changes). Plus free-text `citation_url` / `citation_label` for user-supplied citations the corpus has not ingested yet. CHECK enforces at least one reference column is set. |

All six tables are workspace-scoped (`workspace_id` NOT NULL FK → workspaces, ON DELETE CASCADE) and case-scoped (`case_id` NOT NULL FK → legal_case_records, ON DELETE CASCADE) — except the parent `legal_case_records` itself.

### 106 — RLS policies

**Helper functions (all `STABLE`, `LANGUAGE plpgsql`/`sql`):**
- `current_app_user_id()` — reads `app.user_id` GUC, returns NULL on empty/invalid (fail-closed).
- `current_app_user_role()` — reads `app.user_role` GUC, defaults to `'user'`.
- `current_app_user_is_admin()` — TRUE iff role is `'admin'`.
- `current_user_in_workspace(uuid)` — TRUE iff active workspace_member OR admin.
- `current_user_can_write_workspace(uuid)` — TRUE iff role ∈ {owner, admin, editor, solicitor} OR admin.
- `current_user_can_write_case(workspace_id, assigned_user_id)` — same as `can_write_workspace` plus solicitor restricted to `assigned_user_id = current_app_user_id()`.

**RLS-enabled tables (9):** `users`, `workspaces`, `workspace_members`, `legal_case_records`, `legal_case_facts`, `legal_case_documents`, `legal_case_drafts`, `legal_case_timeline`, `legal_case_sources`.

**Policies (17 created idempotently):**

| Table | Policies |
| --- | --- |
| `users` | `users_self_select`, `users_self_update`, `users_admin_all` |
| `workspaces` | `workspaces_member_select`, `workspaces_admin_update`, `workspaces_admin_insert` |
| `workspace_members` | `workspace_members_member_select`, `workspace_members_admin_write` |
| `legal_case_records` | `legal_case_records_member_select`, `legal_case_records_write` (solicitor-aware) |
| `legal_case_facts` | `legal_case_facts_member_select`, `legal_case_facts_write` (parent-lookup) |
| `legal_case_documents` | same shape as facts |
| `legal_case_drafts` | same shape |
| `legal_case_timeline` | same shape |
| `legal_case_sources` | same shape |

**Corpus tables remain RLS-OFF** (`legal_sources`, `legal_documents`, `legal_chunks`, `legal_cases`, `legal_citations`, `legal_case_law`, `tribunal_decisions`, `rag_runs`, `rag_query_audit`, `answer_audit_log`, `verified_answers_cache`, `source_update_log`, `answer_verification_log`). The verifier asserts this.

---

## 4. Schema compatibility check

Existing tables referenced by the new migrations:

| Reference | Source migration | Exists? |
| --- | --- | --- |
| `public.legal_sources(id)` | 001 | YES (FK from `legal_case_sources` ON DELETE SET NULL) |
| `public.legal_documents(id)` | 001 | YES (FK from `legal_case_sources` ON DELETE SET NULL) |
| `public.legal_chunks(id)` | 001 | YES (FK from `legal_case_sources` ON DELETE SET NULL) |
| `public.legal_cases(id)` | 102 | YES (FK from `legal_case_sources` ON DELETE SET NULL) |
| `public.users` / `public.workspaces` | created in 104 (this sprint) | created HERE; not pre-existing |
| `uk_emp_rag.legal_document_chunks` | 003 | not referenced |

No hard FK to a missing table was created. The repo has no pre-existing user/workspace tables (the orphan `apps/web/types/schema.ts` is types-only, not a migration); 104 creates them cleanly.

---

## 5. RLS verification

| Check | Result |
| --- | --- |
| RLS enabled on every user-data table | PASS (asserted by migration + static verifier + test) |
| Corpus tables left RLS-OFF | PASS (verifier asserts; test enumerates the 13 corpus tables and confirms 106 does not touch them) |
| Helper reads `app.user_id` GUC | PASS |
| Helper reads `app.user_role` GUC | PASS |
| Missing session variables fail closed | PASS (`current_app_user_id()` returns NULL on empty / unparseable input; policies that test `id = NULL` return FALSE) |
| Admin override explicit + limited | PASS (`current_app_user_is_admin()` requires `app.user_role = 'admin'` exactly) |
| Solicitor access limited to assigned cases | PASS (`current_user_can_write_case` requires `wm.role = 'solicitor' AND p_assigned_user_id = public.current_app_user_id()`) |
| Timeline + sources inherit access through legal_case_records | PASS (child write policies use `EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = <child>.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id))`) |

---

## 6. Test outputs

### apps/legal-orchestrator

```
npx tsc --noEmit              -> exit 0 (PASS)
npm run build                 -> exit 0 (PASS)
npx vitest run                -> Test Files 50 passed (50)
                                 Tests 612 passed (612)
                                 Duration 11.32s
```

Test growth this sprint: **+95 tests, +3 files** (from 517 / 47 to 612 / 50).

### Repo verifiers

```
verify-iterlaw-repo.sh                : PASS  (46 active files)
verify-iterlaw-canonical-namespaces.sh: PASS  (8 checks)
verify-iterlaw-v3-safety.sh           : PASS  (6 scoped checks)
verify-iterlaw-rag-db.sh              : PASS  static; NOT EXECUTED live (psql not on PATH)
```

The rag-db verifier output for the new block:

```
PASS         104_user_workspace_foundation.sql present
PASS           104_user_workspace_foundation.sql contains no destructive SQL
PASS           104_user_workspace_foundation.sql has no destructive ALTER
PASS           104_user_workspace_foundation.sql carries no secrets / HTTP call
PASS         105_case_workspace.sql present
PASS           105_case_workspace.sql contains no destructive SQL
PASS           105_case_workspace.sql has no destructive ALTER
PASS           105_case_workspace.sql carries no secrets / HTTP call
PASS         106_enable_rls.sql present
PASS           106_enable_rls.sql contains no destructive SQL
PASS           106_enable_rls.sql has no destructive ALTER
PASS           106_enable_rls.sql carries no secrets / HTTP call
PASS           106 leaves corpus tables RLS-OFF
PASS           106 enables RLS on user-data tables
PASS           106 reads app.user_id GUC
NOT EXECUTED psql not on PATH — skipping live DB checks
```

---

## 7. Static migration safety check

| Pattern | 104 | 105 | 106 |
| --- | --- | --- | --- |
| `DATABASE_URL=` | absent | absent | absent |
| `fetch(` / `curl` / `wget` | absent | absent | absent |
| `postgres://user:pass@…` | absent | absent | absent |
| `github_pat_` / `ghp_` / `sk-…` / `AKIA…` / PEM-key | absent | absent | absent |
| `RightsNow` / `rightsnow` | absent | absent | absent |
| `iterlaw-prod` | absent | absent | absent |
| External LLM hostname | absent | absent | absent |
| `kubectl` / `helm` | absent | absent | absent |

---

## 8. Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| 1 | RLS policies depend on session GUCs (`app.user_id`, `app.user_role`) being set on every request. If the backend forgets to `SET LOCAL app.user_id = …`, every read returns zero rows (fail-closed — by design, but operationally visible). | P1 | Backend integration test asserts that `SET LOCAL` is wrapped around every request; standing integration-test gate. |
| 2 | `legal_case_sources` corpus FKs use `ON DELETE SET NULL`. If a `legal_chunks` row is deleted, the citation row keeps `citation_url` + `citation_label` but loses the structural link. | P2 | Application layer should treat NULL FK + non-NULL `citation_url` as a "stale citation; re-resolve" signal. Documented in table COMMENT. |
| 3 | No `service_role` with `BYPASSRLS` is created by this migration. Operator must provision one for migration runners + audit jobs. | P2 | Operator close-out (see §9). |
| 4 | The `legal_case_records` `primary_issue` CHECK has 17 fixed values. Adding a new issue is a CHECK-replacement which is `ALTER … DROP CONSTRAINT` + `ADD CONSTRAINT` — borderline destructive (idempotent CHECK widening, same pattern as `002_*`). | P3 | Documented; widen via a new additive migration `107_*` rather than editing 105. |
| 5 | No migration runner / `schema_migrations` tracking table. Operator runs `psql -f` in order. | P2 | Sprint 13 follow-up: introduce `golang-migrate` / `flyway` / `node-pg-migrate`. |
| 6 | Three legacy Supabase migration directories still exist (`migrations/`, `apps/web/lib/supabase/migrations/`, `backend/supabase/migrations/`) — clarity risk, not data risk. | P3 | Tracked in `ITERLAW_LOCAL_FIRST_DB_AND_AUTH_ARCHITECTURE.md` §8. |

---

## 9. Staging deployment instructions

**Pre-checks (must all be YES):**
- `DATABASE_URL` points at a confirmed **dev / staging** Postgres only. Not production. The host fragment must NOT contain `iterlaw-postgres.iterlaw-data.svc.cluster.local` (production guard).
- `psql --version` returns Postgres 16 client.
- A `pg_dump --format=custom` snapshot of the current dev DB exists.
- The application is offline / draining (RLS landing changes visible-row counts for an active app).

**Apply order (after the existing 000–010, 101, 102 are already applied):**

```bash
export DATABASE_URL="<DEV_DATABASE_URL_ONLY>"
echo "${DATABASE_URL}" | grep -qE 'iterlaw-postgres\.iterlaw-data' \
  && { echo "FAIL: production host fragment detected"; exit 1; } \
  || echo "OK: not production"

for f in \
  104_user_workspace_foundation.sql \
  105_case_workspace.sql \
  106_enable_rls.sql
do
  echo "==> applying ${f}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -f "apps/legal-orchestrator/db/migrations/${f}"
done
```

**Post-apply verification:**

```bash
bash scripts/infra/verify-iterlaw-rag-db.sh
```

Expected live-DB results: `table public.users`, `table public.workspaces`, `table public.workspace_members`, `table public.legal_case_records`, `table public.legal_case_facts`, `table public.legal_case_documents`, `table public.legal_case_drafts`, `table public.legal_case_timeline`, `table public.legal_case_sources` all `PASS`.

**Backend integration smoke test** (must run **after** apply):

```bash
# Set the request GUCs; expect to read your own user row.
psql "${DATABASE_URL}" -c "
  BEGIN;
  SET LOCAL app.user_id = '<your-user-uuid>';
  SET LOCAL app.user_role = 'user';
  SELECT id, email FROM public.users;
  ROLLBACK;
"

# With no GUC set, expect ZERO rows (fail-closed).
psql "${DATABASE_URL}" -c "SELECT count(*) FROM public.users;"
```

---

## 10. Rollback instructions

Apply down-migrations in reverse order **only on dev / staging**:

```bash
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f apps/legal-orchestrator/db/migrations/106_enable_rls.down.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f apps/legal-orchestrator/db/migrations/105_case_workspace.down.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.down.sql
```

Down migrations are **destructive** (they DROP tables and helper functions). Use only when the data is disposable or has been backed up; the operator close-out checklist (`SPRINT_10_LIVE_DB_CLOSEOUT_OPERATOR_CHECKLIST.md`) carries the snapshot-first rule.

If anything fails mid-apply, the migration uses `ON_ERROR_STOP=1` so the chain halts at the first error. Re-run the failed migration only — it is idempotent.

---

## 11. Git state

```
git status -sb           (pre-commit)
## master...origin/master [ahead 17]
 M docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md
 M scripts/infra/verify-iterlaw-rag-db.sh
?? apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.down.sql
?? apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.sql
?? apps/legal-orchestrator/db/migrations/105_case_workspace.down.sql
?? apps/legal-orchestrator/db/migrations/105_case_workspace.sql
?? apps/legal-orchestrator/db/migrations/106_enable_rls.down.sql
?? apps/legal-orchestrator/db/migrations/106_enable_rls.sql
?? apps/legal-orchestrator/src/tests/migrationSprint13CaseWorkspace.test.ts
?? apps/legal-orchestrator/src/tests/migrationSprint13Rls.test.ts
?? apps/legal-orchestrator/src/tests/migrationSprint13UserWorkspace.test.ts
?? reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md
```

No push performed. Branch remains local at ahead 17 + the new commit.

---

## 12. Safety confirmations

- No production DB touched. The `rag-db` verifier reports `NOT EXECUTED — psql not on PATH`.
- No secrets printed. Static scan PASSed on all six new SQL files for `DATABASE_URL=`, real-shape API keys, PEM headers, and credential URLs.
- No `kubectl apply` / `helm install`. No live cluster contact.
- No deploy. No push (handled by the operator on authorisation).
- No external LLM call. No HTTP / fetch / curl / wget in any migration.
- No project naming changed. `RightsNow` does not appear in any new file. Canonical namespaces preserved.
- No RAG runtime logic changed. The only `src/` change is three new static-test files.

---

## Final status: **PASS**

The user-workspace + case-workspace + RLS block is committed at 104/105/106. 612 tests pass. All four repo verifiers PASS. The chain is safe to apply on a confirmed dev / staging DB by following §9 — the application of the live migration is an operator action, not an agent action.
