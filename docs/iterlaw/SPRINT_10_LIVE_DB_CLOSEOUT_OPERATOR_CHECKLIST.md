# Sprint 10 — Live DB Close-out Operator Checklist

Status: **operator-side action pending.** Code-side wiring for live
RAG retrieval is already in place (see
[`SPRINT_10_LIVE_RAG_PLAN.md`](./SPRINT_10_LIVE_RAG_PLAN.md)) and locked in
by `apps/legal-orchestrator/src/tests/sprint10LiveRagWiring.test.ts`.
What remains is the operator-side migration + smoke test against a
**dev / test** Postgres only.

This checklist is **never** to be executed against the production
database. There is no command in this file that should be run against
production.

---

## 1. Pre-checks (must all be YES before proceeding)

- [ ] `DATABASE_URL` is set to a **dev / test** Postgres only — not
      production. Confirm by inspecting the host fragment manually.
- [ ] The operator is **not** on a session that has any production
      credential in scope.
- [ ] `psql --version` returns a value (Postgres 16 client preferred
      for compatibility with `pg_dump --format=custom`).
- [ ] A fresh snapshot or `pg_dump` of the current dev DB exists, so
      a rollback is possible if any migration misbehaves.
- [ ] All migration files listed in §2 are present locally; nothing
      missing from a partial pull.
- [ ] The matching `*.down.sql` rollback files are present for the
      migrations that have them (see §2).

## 2. Canonical migration chain

Apply in this exact order. Do **not** apply `100_*` — it is a draft
file marked `DO NOT APPLY` (see
[`RAG_SCHEMA_CANONICAL_DECISION.md`](./RAG_SCHEMA_CANONICAL_DECISION.md)).

| # | File | Has down-migration? |
| --- | --- | --- |
| 1 | `000_pgvector_prerequisite.sql` | yes (`.down.sql`) |
| 2 | `001_legal_rag_foundation.sql` | no |
| 3 | `002_legal_rag_sprint6.sql` | yes |
| 4 | `003_legal_rag_sprint9_uk_employment_core.sql` | yes |
| 5 | `004_legal_rag_sprint10_source_registry.sql` | yes |
| 6 | `005_legal_chunks_applicable_to.sql` | no |
| 7 | `006_statutory_rates.sql` | yes |
| 8 | `007_legal_documents_superseded_by.sql` | yes |
| 9 | `008_qa_cache_with_sources.sql` | yes |
| 10 | `009_statutory_rate_calculation_history.sql` | yes |
| 11 | `010_legal_documents_statutory_seed.sql` | yes |
| 12 | `101_reconcile_legal_rag_schema.sql` (additive) | no |
| 13 | `102_add_legal_cases_table.sql` (additive) | no |

> Skip files: `100_iterlaw_core_rag_foundation.sql` — DRAFT.
> See `RAG_SCHEMA_CANONICAL_DECISION.md`.

## 3. Commands

Substitute the placeholder before running. Do **not** put a real DSN
in a committed file. Run from the repository root.

```bash
# 0. Confirm target is NOT production.
export DATABASE_URL="<DEV_DATABASE_URL_ONLY>"
echo "${DATABASE_URL}" | grep -qE '(\.svc\.cluster\.local|iterlaw-postgres\.iterlaw-data)' \
  && { echo "FAIL: production host fragment detected — refuse"; exit 1; } \
  || echo "OK: not production"

# 1. Apply the canonical chain. ON_ERROR_STOP=1 halts on the first
#    SQL error so partial application is impossible.
for f in \
  000_pgvector_prerequisite.sql \
  001_legal_rag_foundation.sql \
  002_legal_rag_sprint6.sql \
  003_legal_rag_sprint9_uk_employment_core.sql \
  004_legal_rag_sprint10_source_registry.sql \
  005_legal_chunks_applicable_to.sql \
  006_statutory_rates.sql \
  007_legal_documents_superseded_by.sql \
  008_qa_cache_with_sources.sql \
  009_statutory_rate_calculation_history.sql \
  010_legal_documents_statutory_seed.sql \
  101_reconcile_legal_rag_schema.sql \
  102_add_legal_cases_table.sql
do
  echo "==> applying ${f}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -f "apps/legal-orchestrator/db/migrations/${f}"
done
```

## 4. Verification

```bash
# psql + DATABASE_URL must both be available for the live checks
# below to flip from NOT EXECUTED to PASS.
bash scripts/infra/verify-iterlaw-rag-db.sh
```

Expected post-migration:

- `extension pgcrypto` — PASS
- `extension vector` — PASS
- `table public.legal_sources` — PASS
- `table public.legal_documents` — PASS
- `table public.legal_chunks` — PASS
- `table public.legal_citations` — PASS
- `table public.legal_case_law` — PASS (from 001)
- `table public.tribunal_decisions` — PASS (from 001)
- `table verified_answers_cache` — PASS (from 101)
- `table rag_runs` — PASS (from 101)
- `table source_update_log` — PASS (from 101)
- `table answer_verification_log` — PASS (from 101)
- `table legal_cases` — PASS (from 102)

Any `NOT DEPLOYED` line means the migration in §2 above did not run
for that table. Re-run from the first missing migration after
investigating the prior error.

## 5. Seed check

At least one official UK employment source row must exist in
`public.legal_sources` (or `uk_emp_rag.legal_sources` for the UK
employment domain) before the live smoke test is meaningful. Until
then, the orchestrator's `retrieveLegalContext` will correctly return
empty + `insufficient_sources` — which is the **safe** default, not a
defect.

Minimum acceptable seed for Sprint 10 close-out:

- 1 row in `uk_emp_rag.legal_sources` for `legislation.gov.uk` —
  e.g. Employment Rights Act 1996 record.
- A corresponding row in `uk_emp_rag.legal_documents`.
- At least one chunk row in `uk_emp_rag.legal_document_chunks`.

The seeding script is **not yet written**; this is a Sprint 10
close-out gap to address with the operator manually loading one
known-good source from `legislation.gov.uk` before the smoke test.

## 6. Smoke test (after migrations + seed)

```bash
# Start the legal-orchestrator with the same DATABASE_URL.
cd apps/legal-orchestrator
DATABASE_URL="${DATABASE_URL}" npm run start &
PID=$!
sleep 5

# /ready should now report rag.mode=postgres and rag.live=true.
curl -s http://localhost:3012/ready | jq

# A real question against the seeded ERA 1996 source should now
# return chunks. Replace `<question>` with one the seeded source
# can plausibly answer.
curl -s -X POST http://localhost:3012/api/legal/ask \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"sprint10-smoke-1","user_id":"u","workspace_id":"w","mode":"ask","question":"<question>","facts":{"dismissal_date":"2026-05-01"}}' \
  | jq

kill "${PID}"
```

Acceptance: at least one response carries `rag_used: true` and a
non-empty `next_steps` that does NOT start with `retrieval:` (which
would mean an empty-result fallback note).

## 7. No production mutation

- **No production DB is touched at any step.** The `grep` guard in
  §3 step 0 refuses any DSN containing the production host fragment.
- **No blind `psql`.** Every command in this file references either
  the controlled migration set or the verifier.
- **No secrets in this doc.** `DATABASE_URL` is a placeholder; the
  operator supplies the real value at the shell.
- **No fake PASS.** The verifier reports `NOT EXECUTED` when `psql`
  is unavailable or `DATABASE_URL` is unset. Do not claim a live-DB
  PASS based on a `NOT EXECUTED` result.
- **No Sprint 10 COMPLETE claim** unless the live verifier returns
  all-PASS and the smoke test returns a cited answer.

## 8. Rollback plan

If anything in §3 fails:

```bash
# Roll back in reverse order, applying only the .down.sql files that
# exist. The migrations without a .down.sql are additive-only and do
# not require rollback.
for f in \
  009_statutory_rate_calculation_history.down.sql \
  008_qa_cache_with_sources.down.sql \
  007_legal_documents_superseded_by.down.sql \
  006_statutory_rates.down.sql \
  004_legal_rag_sprint10_source_registry.down.sql \
  003_legal_rag_sprint9_uk_employment_core.down.sql \
  002_legal_rag_sprint6.down.sql \
  000_pgvector_prerequisite.down.sql
do
  echo "==> rolling back ${f}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 \
    -f "apps/legal-orchestrator/db/migrations/${f}"
done
```

If the dev DB cannot be brought back to a known state with `.down.sql`
alone, restore from the snapshot taken in §1.
