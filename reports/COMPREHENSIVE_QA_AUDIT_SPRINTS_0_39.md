# Comprehensive QA Audit: IterLaw Sprints 0-39

**Date:** 2026-05-16 18:52 Europe/London
**Auditor:** ChatGPT / Codex
**Scope:** Repository audit for IterLaw Sprints 0-39, with local static checks, TypeScript gates, builds, test suites, migrations, and security scans.

---

## Executive Verdict

**Status:** NOT PRODUCTION READY

The core web/shared workspace, backend, api, and legal-orchestrator gates are strong. Legal-orchestrator passed its full 2,806-test Vitest suite and root Jest passed 221 tests.

However, the requested "PRODUCTION READY" conclusion is not supported by the evidence because multiple repository-level blockers remain:

1. Root `npm audit` reports **7 vulnerabilities**: 4 low, 3 high.
2. `apps/ai-orchestrator` cannot typecheck or test in the current checkout because dependencies are not installed/resolvable (`express`, `cors`, `helmet`, and `vitest` missing).
3. `apps/synthesis-worker` typecheck/build pass, but `npm run test` fails because `vitest` is not installed/resolvable in that app.
4. `scripts/smoke/iterlaw-mvp-smoke.ps1` fails to parse under PowerShell due an encoding/mojibake issue around an em dash character class.
5. Migration reversibility is incomplete: 5 up migrations lack matching `.down.sql` files.
6. The working tree contains unrelated Sprint 40 changes during the audit, so this was not a clean Sprints 0-39-only tree.

Recommendation: fix the blockers above, re-run this audit, then reassess production readiness.

---

## Inventory

| Metric | Value |
|---|---:|
| Files tracked by repo scan, excluding generated/vendor folders | 941 |
| Test files found by repo scan | 188 |
| Legal-orchestrator up migrations | 46 before the concurrent Sprint 40 file; 47 after untracked Sprint 40 appeared |
| Legal-orchestrator down migrations | 41 before the concurrent Sprint 40 file; 42 after untracked Sprint 40 appeared |
| Sprint-complete tags visible | `sprint-16-complete` through `sprint-39-complete`, plus `sprint-57-complete` |
| HEAD at audit start | `7adb1b0 docs(sprint-39): sprint report` |

The repository already contains migration files beyond Sprint 39 (`115_sprints_35_45`, `116_sprints_46_51`, `117_sprints_52_57`) and an existing `sprint-57-complete` tag. During audit execution, additional untracked Sprint 40 files appeared. That does not invalidate the Sprint 0-39 tests, but it prevents treating this checkout as a pristine Sprints 0-39 state.

---

## Verification Results

| Area | Command / Check | Result |
|---|---|---|
| Root web lint | `npm run lint` | PASS: no ESLint warnings/errors. Next warns that `next lint` is deprecated. |
| Root web typecheck | `npm run typecheck` | PASS |
| Root Jest | `npm run test -- --runInBand` | PASS: 48 suites, 221 tests |
| Root build | `npm run build` | PASS: shared + Next production build; warning about `experimental.outputFileTracingRoot` moved to top-level `outputFileTracingRoot` |
| Legal-orchestrator typecheck | `npm run typecheck` in `apps/legal-orchestrator` | PASS |
| Legal-orchestrator tests | `npm run test` in `apps/legal-orchestrator` | PASS: 131 files, 2,806 tests |
| Legal-orchestrator build | `npm run build` in `apps/legal-orchestrator` | PASS |
| Backend typecheck | `npm run typecheck` in `backend` | PASS |
| Backend build | `npm run build` in `backend` | PASS |
| Backend Phase 1 E2E | `npm run test:phase1` in `backend` | PASS |
| API typecheck | `npm run typecheck` in `api` | PASS |
| API build | `npm run build` in `api` | PASS |
| AI orchestrator typecheck | `npm run typecheck` in `apps/ai-orchestrator` | FAIL: missing `express`, `cors`, `helmet` modules/types |
| AI orchestrator tests | `npm run test` in `apps/ai-orchestrator` | FAIL: `vitest` not recognized |
| Synthesis worker typecheck | `npm run typecheck` in `apps/synthesis-worker` | PASS |
| Synthesis worker build | `npm run build` in `apps/synthesis-worker` | PASS |
| Synthesis worker tests | `npm run test` in `apps/synthesis-worker` | FAIL: `vitest` not recognized |
| Smoke script | `powershell -ExecutionPolicy Bypass -File scripts/smoke/iterlaw-mvp-smoke.ps1` | FAIL: parser errors at line 233 from mojibake around an em dash character class |
| Secret-shape scan | Regex scan for AWS/GCP/Slack/private-key/postgres-credential patterns excluding generated/vendor/report/temp files | PASS: no hits |
| RLS static scan | SQL scan for RLS/policy/user-scope primitives | PASS static evidence present: 52 `ENABLE ROW LEVEL SECURITY`, 119 `CREATE POLICY`, 103 admin-helper refs, 92 user-scope refs |

---

## Migration Review

RLS and policy coverage are visibly present across workspace, auth, case, retrieval, WASM, and document-intelligence migrations.

Reversibility is incomplete. The following up migrations have no matching `.down.sql` file:

```text
001_legal_rag_foundation.sql
005_legal_chunks_applicable_to.sql
100_iterlaw_core_rag_foundation.sql
101_reconcile_legal_rag_schema.sql
102_add_legal_cases_table.sql
```

All checked up migration files use `CREATE TABLE IF NOT EXISTS`; no non-comment `CREATE TABLE` without `IF NOT EXISTS` was found by the evidence script.

---

## Security And Quality Findings

The targeted secret-shape scan found no concrete AWS/GCP/Slack/private-key/postgres credential values in non-generated repo files.

Legal-orchestrator focused quality scan found:

| Check | Count |
|---|---:|
| `TODO` / `FIXME` / `XXX` in legal-orchestrator src | 0 |
| `console.*` outside tests and structured logger utilities | 0 |
| hardcoded quoted secret-like assignments in non-test orchestrator source | 0 |
| `.skip` / `.only` in orchestrator tests | 0 |

Root `npm audit` is not clean:

```text
7 vulnerabilities (4 low, 3 high)
```

Legal-orchestrator `npm audit` is clean:

```text
found 0 vulnerabilities
```

---

## Working Tree

The audit started clean against `origin/master`, then concurrent/unrelated Sprint 40 changes appeared during the run:

```text
modified: apps/legal-orchestrator/src/coherentSystem/zone2WasmStub.ts
modified: apps/legal-orchestrator/src/coherentSystem/zone2WasmTypes.ts
untracked: apps/legal-orchestrator/db/migrations/136_sprint40_wasm_merkle_evidence_tree.sql
untracked: apps/legal-orchestrator/db/migrations/136_sprint40_wasm_merkle_evidence_tree.down.sql
untracked: apps/legal-orchestrator/src/coherentSystem/wasmMerkleCommitmentPhase6.ts
untracked: apps/legal-orchestrator/src/coherentSystem/wasmZkpVerificationPhase7.ts
untracked: apps/legal-orchestrator/src/coherentSystem/wasmLedgerIntegrationPhase8.ts
untracked: apps/legal-orchestrator/src/coherentSystem/wasmAggregationPhase9.ts
untracked: apps/legal-orchestrator/src/coherentSystem/wasmDisputeResolutionPhase10.ts
untracked: apps/legal-orchestrator/src/tests/sprint40WasmMerkleCommitmentPhase6.test.ts
```

These files were not included in this audit commit.

---

## Required Fixes Before Re-Audit

1. Resolve root `npm audit` high vulnerabilities or document accepted risk with dependency owners.
2. Install and lock dependencies for `apps/ai-orchestrator`, then re-run typecheck/build/test.
3. Install and lock test dependencies for `apps/synthesis-worker`, then re-run `npm run test`.
4. Fix `scripts/smoke/iterlaw-mvp-smoke.ps1` encoding/parser failure and re-run it.
5. Add missing down migrations or explicitly mark those migrations as irreversible with operator-approved rationale.
6. Re-run audit from a clean, tagged checkout for the intended sprint range.

---

## Final Recommendation

**Not approved for production and not approved as a clean Sprints 0-39 closure audit.**

The strongest evidence is in legal-orchestrator and web, but repo-level readiness is blocked by dependency/test gaps, audit vulnerabilities, smoke-script failure, incomplete migration reversibility, and checkout drift.
