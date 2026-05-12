# Sprint 10 — Local Docker DB Verification Evidence

> **Status: LOCAL DOCKER VERIFICATION PASS.**
> This is **NOT** the real staging DB verification.
> Real staging DB verification: **PENDING**.
> Production: **BLOCKED**.

## 1. Run metadata

| Field | Value |
| --- | --- |
| Date | 2026-05-12 |
| Environment | Local Docker pgvector PostgreSQL |
| Image | `pgvector/pgvector:pg16` |
| DB name | `iterlaw_dev` |
| Operator | local workstation (not AKS, not real staging) |
| Network | local-host only |
| Result | **PASS for local Docker scope only** |

## 2. Migrations applied

The operator applied the **full safe forward migration chain**, in numeric order, **excluding** `*.down.sql` files and the bannered `100_iterlaw_core_rag_foundation.sql` draft.

Applied forward chain:

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
101_reconcile_legal_rag_schema.sql
102_add_legal_cases_table.sql
104_user_workspace_foundation.sql
105_case_workspace.sql
106_enable_rls.sql
```

Skipped intentionally:

- `100_iterlaw_core_rag_foundation.sql` — bannered DO NOT APPLY draft.
- `103_*` — reserved for future GraphRAG (AI Architect AIA scope).
- All `*.down.sql` files — rollback files, not part of the forward chain.

## 3. Original issue + fix

**Issue (first attempt):** the operator initially applied **only** `104_user_workspace_foundation.sql`, `105_case_workspace.sql`, `106_enable_rls.sql` against a fresh empty database. `105_case_workspace.sql` failed because its `legal_case_sources` FKs reference `legal_sources` / `legal_documents` / `legal_chunks` / `legal_cases` — tables created by migrations `001` and `102` in the canonical chain.

**Fix:** the operator reset the Docker DB and applied the **full safe forward chain** above. `104`, `105`, `106` then applied cleanly because their parent corpus tables were already present.

**Architecture implication:** the Sprint 10 user-data block (`104` / `105` / `106`) is **not standalone**. It depends on the corpus chain (`000` → `010`, `101`, `102`). The operator checklist in `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md` §1 already states this ("After the existing canonical chain `000 → 010, 101, 102` has been applied …") — and this run confirms why that ordering is mandatory.

No migration SQL was changed to make this work. The fix was operator procedure (apply the full chain in order), not a code change.

## 4. Verification results

All checks performed against the local Docker DB only. **Not real staging.**

| Check (per the staging operator checklist) | Local Docker result |
| --- | --- |
| §3 Tables exist (9 user-data rows) | **PASS** |
| §3 Tables exist (corpus `legal_cases` row) | **PASS** |
| §4 Indexes exist (per-table `idx_*` named indexes + primary keys) | **PASS** |
| §5 RLS policies exist (~17 across 9 user-data tables) | **PASS** |
| §6 `relrowsecurity = t` on user-data tables (9 rows) | **PASS** |
| §6 `relforcerowsecurity` posture | matches the 106 design (RLS enabled, not forced) |
| §7 Corpus tables remain `relrowsecurity = f` | **PASS** |

The operator did not transcribe row-level SQL output into this report because the local Docker DB has no production data; the per-row PASS marker is the operator's transcription of `psql` output run interactively.

## 5. What this evidence does and does NOT establish

**Establishes:**

- The migration chain `000 → 010, 101, 102, 104, 105, 106` applies cleanly on a fresh `pgvector/pgvector:pg16` database.
- The DDL is syntactically valid against Postgres 16 + pgvector.
- All required tables, indexes, and RLS policies materialise as designed.
- `relrowsecurity` flips ON for the nine user-data tables; corpus stays OFF.
- The migration ordering dependency (`105` depends on `001` + `102`) is real and documented.

**Does NOT establish:**

- That the migration chain is safe on a real **dev / staging** PostgreSQL with prior schema state.
- That the operator-side §0 pre-conditions (snapshot, app drain, kubeconfig context check) are met for the real staging DB.
- That the §8 RLS test plan (C.1 user-A-vs-B isolation, C.2 fail-closed, C.3 solicitor scoping, C.4 admin override, C.5 child-table inheritance) passes against a multi-user dataset.
- That `bash scripts/infra/verify-iterlaw-rag-db.sh` run with a real staging `DATABASE_URL` returns all-PASS.
- That production is approved (it is not — production remains **BLOCKED**).

## 6. Limitation note

This is **local Docker DB verification only**. Real staging DB verification is structurally **operator action** on a confirmed dev / staging Postgres with the application drained, snapshot taken, and the full §3–§8 evidence captured into a sign-off log per the operator checklist.

The local AKS kubeconfig context observed earlier (`aks-iterlaw-we-prod`) is a **production** cluster. AKS DB verification therefore remains blocked until a confirmed non-production staging context exists (either a dedicated AKS staging cluster or a non-AKS staging path).

## 7. Status posture after this run

| Item | Status |
| --- | --- |
| Sprint 10 repo implementation | **PASS** (typecheck / build / vitest 615 / 51) |
| Sprint 10 docs + operator checklist | **PASS** |
| Sprint 10 k8s footgun neutralised | **PASS** |
| Sprint 10 guardrails (verifier scripts + safety tests) | **PASS** |
| **Sprint 10 local Docker DB migration-chain verification** | **PASS (this run)** |
| **Sprint 10 real staging DB verification** | **PENDING** (operator action; needs confirmed staging context + §0–§13 of the operator checklist) |
| **Production** | **BLOCKED** |

Sprint 10 remains **PARTIAL** at the project level until the real staging DB verification is recorded.

## 8. Next operator action

Same as the prior turn — the local Docker run is **additional evidence** that the chain is sound; it does **not** substitute for staging.

1. Provision or confirm a non-production staging Postgres (AKS staging cluster, a separate non-prod kubeconfig context, or a non-cluster dev DB pointed at by `DATABASE_URL`).
2. Take a `pg_dump --format=custom` snapshot of that staging DB.
3. Drain the application against staging.
4. Run the full operator checklist (`docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`) end-to-end.
5. Capture the §12 sign-off into `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.
6. Commit the log + flip `SPRINT_INDEX.md` + `SPRINT_10_DB_DECISIONS.md` per checklist §13.

## 9. Truth statement

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.
