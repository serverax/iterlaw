# Sprint 10 — Staging DB Operator Checklist

Single source of truth for the operator action that closes Sprint 10. Read top-to-bottom. **Dev / staging only.** Production is **BLOCKED** until this checklist returns all-PASS and the sign-off is recorded.

## 0. Pre-conditions (must all be YES before running anything)

- [ ] `DATABASE_URL` points at a confirmed **dev / staging** Postgres. Not production.
- [ ] The DSN host fragment does **not** contain `iterlaw-postgres.iterlaw-data.svc.cluster.local`. (The restore script's production guard refuses that fragment; the same rule applies here.)
- [ ] `psql --version` returns a Postgres 16 client.
- [ ] A `pg_dump --format=custom` snapshot of the current dev DB exists.
- [ ] The application is offline / draining for the duration of the apply (RLS landing changes visible-row counts for an active session).
- [ ] The active `kubectl config current-context` is **not** a production cluster.

If any pre-condition is NO, **stop here**.

## 1. Migration files to apply (exact order)

After the existing canonical chain `000 → 010, 101, 102` has been applied, apply the Sprint 10 user-data block:

```
apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.sql
apps/legal-orchestrator/db/migrations/105_case_workspace.sql
apps/legal-orchestrator/db/migrations/106_enable_rls.sql
```

`103_*` is intentionally **absent** — reserved for future GraphRAG (AI Architect AIA scope). Do not apply `100_iterlaw_core_rag_foundation.sql` — it is the DO-NOT-APPLY draft.

## 2. Apply commands

```bash
export DATABASE_URL="<DEV_DATABASE_URL_ONLY>"

# Production-host refusal guard (mirrors restore-from-borg.sh):
echo "${DATABASE_URL}" | grep -qE 'iterlaw-postgres\.iterlaw-data' \
  && { echo "FAIL: production host fragment detected — refuse"; exit 1; } \
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

`ON_ERROR_STOP=1` halts the chain on the first SQL error so partial application is impossible.

## 3. SQL verification — tables exist (expect 9 rows)

```sql
SELECT tablename
FROM pg_tables
WHERE tablename IN (
  'users',
  'workspaces',
  'workspace_members',
  'legal_case_records',
  'legal_case_facts',
  'legal_case_documents',
  'legal_case_drafts',
  'legal_case_timeline',
  'legal_case_sources'
)
ORDER BY tablename;
```

## 4. SQL verification — indexes exist

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN (
  'users',
  'workspaces',
  'workspace_members',
  'legal_case_records',
  'legal_case_facts',
  'legal_case_documents',
  'legal_case_drafts',
  'legal_case_timeline',
  'legal_case_sources'
)
ORDER BY tablename, indexname;
```

Expected: every primary-key index plus every named `idx_*` index (see Sprint 10 QA report §3 + Appendix B.2 for the canonical list).

## 5. SQL verification — RLS policies exist

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN (
  'users',
  'workspaces',
  'workspace_members',
  'legal_case_records',
  'legal_case_facts',
  'legal_case_documents',
  'legal_case_drafts',
  'legal_case_timeline',
  'legal_case_sources'
)
ORDER BY tablename, policyname;
```

Expected: ~17 policies (3 on `users`, 3 on `workspaces`, 2 on `workspace_members`, 2 each on the six case tables).

## 6. SQL verification — `relrowsecurity` enabled on user-data tables

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'users','workspaces','workspace_members','legal_case_records',
  'legal_case_facts','legal_case_documents','legal_case_drafts',
  'legal_case_timeline','legal_case_sources'
)
ORDER BY relname;
```

Expected: `relrowsecurity = t` for all 9 rows.

`relforcerowsecurity` is **not** enabled by migration 106. RLS is **enabled** but **not forced** because the migration runner / `service_role` is expected to bypass via `BYPASSRLS`. If the operator wants force-RLS even for owners, run a separate operator-scoped `ALTER TABLE … FORCE ROW LEVEL SECURITY` per table and document it. This is **not** a Sprint 10 deliverable.

## 7. SQL verification — corpus tables remain RLS-OFF

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN (
  'legal_sources','legal_documents','legal_chunks','legal_cases',
  'legal_citations','legal_case_law','tribunal_decisions',
  'rag_runs','rag_query_audit','answer_audit_log',
  'verified_answers_cache','source_update_log','answer_verification_log'
)
ORDER BY relname;
```

Expected: `relrowsecurity = f` for every row. Corpus is shared knowledge.

## 8. RLS test plan (must all PASS before sign-off)

Run each test from a `psql` shell against the staging DB. Each test is wrapped in a transaction so it leaves no side effects. Substitute the real UUIDs from your seed.

Full SQL bodies are in `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` **Appendix C**. Summary of the five required passes:

- [ ] **C.1 User-A vs User-B isolation.** User A's session sees only A's cases (count = 1); User B's session sees only B's cases (count = 1).
- [ ] **C.2 Missing session variables fail closed.** With no `SET LOCAL app.user_id`, `SELECT count(*) FROM legal_case_records` returns 0.
- [ ] **C.3 Solicitor restricted to assigned cases.** A solicitor (workspace member, role `'solicitor'`) sees only the case with `assigned_user_id = current_app_user_id()`; UPDATE on an unassigned case affects 0 rows.
- [ ] **C.4 Admin override gated.** `SET LOCAL app.user_role = 'admin'` returns all rows; `SET LOCAL app.user_role = 'user'` returns only the user's own.
- [ ] **C.5 Child-table inheritance.** A `legal_case_timeline` row attached to A's case is invisible to B's session and visible to A's session.

If any test fails, **do not sign off**. Investigate via:

```sql
SELECT pg_policies.* FROM pg_policies WHERE tablename = '<failing table>';
```

## 9. Rollback notes

Each migration ships a matching `.down.sql`. Rollback in reverse order, only on staging, only after the snapshot from §0 is verified:

```bash
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
  -f apps/legal-orchestrator/db/migrations/106_enable_rls.down.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
  -f apps/legal-orchestrator/db/migrations/105_case_workspace.down.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
  -f apps/legal-orchestrator/db/migrations/104_user_workspace_foundation.down.sql
```

The down-migrations are **destructive** (`DROP TABLE`, `DROP FUNCTION`, `DISABLE ROW LEVEL SECURITY`). If real user data exists on staging, restore from the §0 snapshot instead.

## 10. Evidence to collect

Operator captures and attaches to the sign-off section below:

- [ ] `psql --version` output.
- [ ] `DATABASE_URL` host fragment (NOT the full DSN; redact user/password).
- [ ] Output of each `psql -f <migration>` run (exit code + last 10 lines).
- [ ] Output of the 5 SQL verification queries (§3 through §7).
- [ ] Pass/fail per RLS test (§8 C.1–C.5).
- [ ] `bash scripts/infra/verify-iterlaw-rag-db.sh` run with `psql` on PATH and `DATABASE_URL` set — expect previously `NOT EXECUTED` live-DB checks to flip to `PASS`.
- [ ] A timestamped log file under `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.

## 11. Hard rules during apply

- **No production DB.** The §0 + §2 guard refuses the production host fragment.
- **No `kubectl apply`.** The application stays offline / draining via the existing rollout mechanism, not via `kubectl`.
- **No secret values in this checklist or in the evidence log.** Use placeholders. Redact DSN credentials in any captured output.
- **No external LLM call.** This is a DB-only operation.
- **No push of the evidence log to a public branch** without operator review.

## 12. Sign-off section (operator fills in)

> **DO NOT** edit the checklist itself — copy the section below into the timestamped evidence log and complete there.

```
SPRINT 10 STAGING DB SIGN-OFF
=============================
Operator:           <name>
Date / time (UTC):  <YYYY-MM-DDTHH:MM:SSZ>
DSN host fragment:  <staging-host-without-credentials>
psql client:        <psql --version output>

§3 tables exist (9 rows):              PASS / FAIL
§4 indexes exist:                      PASS / FAIL
§5 RLS policies exist (~17):           PASS / FAIL
§6 relrowsecurity on user-data tables: PASS / FAIL
§7 corpus tables RLS-OFF:              PASS / FAIL

§8 RLS test plan:
  C.1 user-A vs user-B isolation:      PASS / FAIL
  C.2 missing GUC fail-closed:         PASS / FAIL
  C.3 solicitor assigned-only:         PASS / FAIL
  C.4 admin override gated:            PASS / FAIL
  C.5 child-table inheritance:         PASS / FAIL

verify-iterlaw-rag-db.sh (live):       PASS / FAIL
Snapshot taken (pg_dump):              YES / NO
Snapshot location:                     <path>

Overall result:                        PASS / PARTIAL / FAIL
Production deploy authorised:          NO  (production remains BLOCKED until any future authorised promotion)

Operator signature:                    <signed off>
```

## 13. After successful sign-off

When the sign-off above is `PASS / PARTIAL` (PARTIAL only acceptable when the verifier returns documented WARN, e.g. one of the Sprint-12 backup CIDR items):

1. Update `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` Sprint 10 row: change `staging DB verification: PENDING` to `staging DB verification: PASS (YYYY-MM-DD)`.
2. Update `docs/iterlaw/project/07-sprints/SPRINT_10_DB_DECISIONS.md` "Deployment gate" line: replace `Staging DB verification PENDING` with `Staging DB verification PASS (YYYY-MM-DD)`.
3. Commit both updates as a single commit: `docs(sprint-10): close out staging DB verification`.
4. **Do not push** without explicit instruction.
5. **Do not begin production deploy** — production remains BLOCKED until an explicit operator decision authorises it.
