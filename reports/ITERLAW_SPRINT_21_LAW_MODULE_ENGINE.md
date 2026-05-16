# IterLaw Sprint 21 — Law Module Engine (Phase 1)

## Scope

- **DB:** `112_sprint21_law_module_engine_phase1.sql` — `law_module_engine_runs` (user-scoped audit rows, evidence pack version, optional `reranker_score`, JSON `result_summary`). RLS: self read/insert, admin update/delete.
- **Code:** `apps/legal-orchestrator/src/lawModuleEngine/`
  - `inputFingerprint.ts` — canonical input fingerprint for dedupe / audit.
  - `rerankerBlend.ts` — blend reranker score with calculator `implemented` / `planned` readiness.
  - `evidencePackMetrics.ts` — evidence density + quality scalar.
  - `phase1Orchestrator.ts` — `runLawModuleEnginePhase1` ties **statutory calculator registry** lookup, declared-input coverage, fingerprint, evidence metrics, blend (pure; no DB write).

## Verify

From `apps/legal-orchestrator`: `npm run typecheck && npm test`.

**Last verification:** **1437** Vitest tests (orchestrator), commit **`0236ea4`** on `master`.
