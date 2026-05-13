# IterLaw QA Report — Sprint 10 Migration 102 Compatibility Fix

**Date:** 2026-05-13.
**Owner:** QA AIA + DB / RAG AIA.
**Subject commit:** `c17ffc2 fix(iterlaw): make legal cases migration compatible with legacy schema`.

## Status

**PASS** for code / static verification.
**Sprint 10 remains PARTIAL** until real dev / staging DB replay passes.

## Root cause

The Docker staging replay applies every `apps/legal-orchestrator/db/migrations/*.sql` in numeric order. In that order:

1. **`100_iterlaw_core_rag_foundation.sql`** runs first and creates `public.legal_cases` with the draft Master-Order shape — including `judgment_date` (DATE) but **no** `decision_date`, **no** `source_id`, **no** `source_provider`, **no** `metadata`, **no** `case_name`, **no** `jurisdiction`, **no** `url`, **no** `summary`, **no** `full_text`, **no** `updated_at`. (`100` was originally marked `⚠ DRAFT / DO NOT APPLY ⚠`; an earlier compat shim makes its own indexes succeed but does **not** add the 102-shape columns.)
2. `101` runs next, doesn't touch `legal_cases`.
3. **`102_add_legal_cases_table.sql`** runs. `CREATE TABLE IF NOT EXISTS public.legal_cases (...)` is a **silent no-op** because the 100-shape table already exists.
4. 102's first two indexes (`idx_legal_cases_neutral_citation`, `idx_legal_cases_court`) match the 100 shape and Postgres skips them with `IF NOT EXISTS`.
5. 102's next index `CREATE INDEX IF NOT EXISTS idx_legal_cases_decision_date ON public.legal_cases (decision_date)` **fails** with `ERROR: column "decision_date" does not exist`.
6. Other 102 indexes would also fail on the 100 shape: `idx_legal_cases_source_provider`, `idx_legal_cases_source_id`, `idx_legal_cases_metadata_gin`.

`100` and `102` use **inconsistent** date-column names (`judgment_date` vs `decision_date`). They are not synonyms; the orchestrator queries the 102-shape `decision_date`.

## Fix verified

Implemented in commit `c17ffc2` by inserting a Compatibility ALTER block in `102_add_legal_cases_table.sql` **after** `CREATE TABLE IF NOT EXISTS public.legal_cases` and **before** every `CREATE INDEX`. The block adds every column 102's indexes reference (plus the remaining 102-only columns for schema completeness):

```sql
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS source_id        UUID;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS case_name        TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS jurisdiction     TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS decision_date    DATE;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS url              TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS source_provider  TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS summary          TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS full_text        TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();
```

Safety properties:

- **`ADD COLUMN IF NOT EXISTS`** — no-op when the column already exists (fresh-DB path; 102's `CREATE TABLE` declares all columns).
- **No `NOT NULL`** on additive columns — existing rows cannot fail to satisfy a new constraint.
- **`DEFAULT '{}'::jsonb`** and **`DEFAULT now()`** — safe on Postgres 11+ (no row rewrite; default applied lazily for existing rows on read).
- **No `DROP`, `DELETE`, `TRUNCATE`, `RENAME`, `SET NOT NULL`** anywhere in the file (verified by `migration102CompatibilityShim.test.ts` with SQL comments stripped).
- **No FK changes.**
- Existing test contract preserved: `namespaceAndSchemaPolicy.test.ts` still asserts `CREATE TABLE IF NOT EXISTS public.legal_cases` and the canonical column list.

## Files reviewed

- `apps/legal-orchestrator/db/migrations/100_iterlaw_core_rag_foundation.sql`
- `apps/legal-orchestrator/db/migrations/102_add_legal_cases_table.sql`
- `apps/legal-orchestrator/db/migrations/105_case_workspace.sql` (FK reference to `legal_cases(id)` — works with both shapes)
- `apps/legal-orchestrator/db/migrations/106_enable_rls.sql` (legal_cases mention is comment-only)
- `apps/legal-orchestrator/src/tests/migration102CompatibilityShim.test.ts`
- `apps/legal-orchestrator/src/tests/migration100CompatibilityShim.test.ts`
- `apps/legal-orchestrator/src/tests/migrationChainSprint10Convention.test.ts`
- `apps/legal-orchestrator/src/tests/namespaceAndSchemaPolicy.test.ts`

## Commands run

| Command (cwd `apps/legal-orchestrator`) | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | **PASS** |
| `npm run build` | 0 | **PASS** (`tsc`) |
| `npx vitest run src/tests/migration102CompatibilityShim.test.ts` | 0 | **11 / 11 PASS** |
| `npx vitest run` (full suite) | 0 | **55 files / 708 tests PASS** |

Static-SQL scan across the chain (comments stripped) for `DROP|DELETE FROM|TRUNCATE` against `legal_cases`: **zero matches**.

## Test result

| Layer | Result |
| --- | --- |
| Typecheck | **PASS** (exit 0) |
| Build | **PASS** (exit 0) |
| Targeted shim test (`migration102CompatibilityShim.test.ts`) | **PASS** (11 / 11) |
| Full vitest suite | **PASS** (55 files / 708 tests) |

No DB was touched. No network call was made.

## Remaining Sprint 10 blocker

The real dev / staging DB replay has **not** been re-run since the fix. Until it is, **Sprint 10 stays PARTIAL**.

Required chain (numeric order; no 103):

```
000_pgvector_prerequisite.sql
001_legal_rag_foundation.sql
002_legal_rag_sprint6.sql
003_legal_rag_sprint9_uk_employment_core.sql
004_legal_rag_sprint10_source_registry.sql
005_legal_chunks_applicable_to.sql
006_statutory_rates.sql
007_legal_documents_superseded_by.sql
008_qa_cache_with_sources.sql
009_statutory_rate_calculation_history.sql
010_legal_documents_statutory_seed.sql
100_iterlaw_core_rag_foundation.sql
101_reconcile_legal_rag_schema.sql
102_add_legal_cases_table.sql
104_user_workspace_foundation.sql
105_case_workspace.sql
106_enable_rls.sql
```

The operator must re-run this chain against a confirmed dev / staging DB per the runbook at `docs/iterlaw/project/07-sprints/SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md` and the long-form checklist at `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`. Both have been amended in this turn to point at the post-fix replay (see §"Required replay after migration 102 compatibility fix").

## Sprint status (post-fix, unchanged)

- Sprint 10 code-side migration verification: **PASS** (this report).
- Sprint 10 real dev / staging DB replay: **PENDING** — required after this fix.
- Sprint 10 overall: **PARTIAL**.
- Sprint 11: **BLOCKED**.
- Production: **BLOCKED**.

## Safety statement

> No production DB touched.
> No deployment performed.
> No push performed.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed.
