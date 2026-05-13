# Sprint 19A — Multi-Tier Retrieval Wiring + Benchmark Harness Report

## STATUS: PASS

Feature flag `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED` (default OFF) wired into `handleLegalRequest`. When OFF, behaviour unchanged. When ON, gateway runs in shadow / telemetry-only mode (no public-response change). Benchmark harness `scripts/bench/iterlaw-retrieval-benchmark.mjs` runs against three mock scenarios and emits metrics. **No production speed claim.** Tests: 9 new vitest cases for Sprint 19A PASS. Orchestrator suite **77 files / 957 tests PASS**.

---

## 1. Files added

- `apps/legal-orchestrator/src/retrieval/multiTierRetrievalGateway.ts` — gateway adapter (committed in Sprint 18A commit alongside the handleLegalRequest wiring; conceptually belongs to Sprint 19A and is documented here).
- `apps/legal-orchestrator/src/tests/multiTierRetrievalFlag.test.ts` — 9 vitest cases (flag behaviour + gateway behaviour + safety).
- `scripts/bench/iterlaw-retrieval-benchmark.mjs` — mock benchmark harness.
- `docs/iterlaw/project/09-retrieval/RETRIEVAL_BENCHMARK_HARNESS.md` — benchmark documentation.

## 2. Files modified

- `apps/legal-orchestrator/src/config/featureFlags.ts` — added `getMultiTierRetrievalConfig()` (added together with `getLawModuleRoutingConfig()` in Sprint 18A's commit).
- `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` — added the Sprint 19A flag-guarded block. Shadow-only.
- `apps/legal-orchestrator/src/retrieval/index.ts` — re-exports the gateway.

## 3. Feature-flag contract

- `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED` defaults to OFF.
- Recognised ON values: `"true"`, `"TRUE"`, `"1"`, `"yes"`, `"on"` (case-insensitive, trim-tolerant).
- When OFF: `handleLegalRequest` never calls the gateway; behaviour is byte-identical to the pre-19A path.
- When ON: gateway runs in shadow mode. Result is captured to a local `multiTierShadowTrace` variable and intentionally not placed on the public response. Errors collapse to "no shadow trace this turn" so the legacy answer path is never broken.

## 4. Gateway behaviour with no adapters (default ON scenario)

With the flag ON but no injected `fullTextSearch` / `vectorSearch` / `exactApprovedLookup` / `rulesLookup`:

- Every tier returns `status: "skipped"` (no adapter) or `"no_results"`.
- Final candidate count is 0.
- `insufficientSources` is `true`.
- Decision trace is recorded.

This is the **safe default**: the gateway never invents data, never reaches a network, never hits a DB.

## 5. Test evidence

```
$ npx vitest run src/tests/multiTierRetrievalFlag.test.ts
✓ src/tests/multiTierRetrievalFlag.test.ts (9 tests)
Test Files  1 passed (1)
     Tests  9 passed (9)
exit 0
```

Cases:

- Flag defaults to OFF.
- Flag OFF for empty / "false" / "0" / "no" / arbitrary.
- Flag ON only for explicit "true" / "1" / "yes" / "on".
- No-adapters path returns `insufficient_sources` and an empty final set.
- Exact-approved injected match returns one candidate and the trace contains `short_circuit:exact_approved_qa`.
- Stale (superseded) candidate excluded from final.
- Failed-QA candidate excluded from final.
- Decision trace starts with `multi_tier_gateway:entered` and ends with `multi_tier_gateway:final_count:...`.
- Gateway module has no external LLM / network imports (static source scan).

## 6. Benchmark harness output (mock data only)

```
[BENCH] scenario:no_adapters
  selected_tiers   = []
  final_count      = 0
  excluded_trust   = 0
  excluded_freshness = 0
  excluded_metadata  = 0
  context_pack_size  = 0
  elapsed_ms       = 1.66

[BENCH] scenario:exact_short_circuit
  selected_tiers   = ["exact_approved_qa"]
  final_count      = 1
  excluded_trust   = 0
  excluded_freshness = 0
  excluded_metadata  = 0
  context_pack_size  = 1
  elapsed_ms       = 0.14

[BENCH] scenario:full_text_plus_vector_with_trust_and_freshness_filters
  selected_tiers   = ["full_text","vector","fused_full_text_vector"]
  final_count      = 2
  excluded_trust   = 1
  excluded_freshness = 1
  excluded_metadata  = 1
  context_pack_size  = 2
  elapsed_ms       = 0.39
```

Scenario 3 confirms all three filters are firing (1 candidate rejected by each of trust / freshness / metadata). The harness writes an optional markdown report to `reports/logs/` when invoked with `--write-report`.

**No production speed claim is derived from these numbers.** They are mock measurements only.

## 7. Full QA

```
$ npm run typecheck                              →   exit 0
$ npm run lint                                   →   exit 0
$ npm run build                                  →   exit 0
$ npm test                                       →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm run typecheck →   exit 0
$ cd apps/legal-orchestrator && npm run build    →   exit 0
$ cd apps/legal-orchestrator && npm test         →   77 files / 957 tests PASS    exit 0
$ node scripts/bench/iterlaw-retrieval-benchmark.mjs → exit 0
```

Vitest grew 76/948 → **77/957** (+1 file, +9 tests).

## 8. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- Flag default is OFF. Behaviour with flag OFF is unchanged.
- Gateway never reaches the network, never reads a DB, never calls an external LLM.
- Benchmark harness uses mock data only and is documented as such; no production speed claim.

## 9. Sprint 19A verdict

**STATUS: PASS** — default-OFF wiring exists, tests pass, benchmark runs against mock data, no fake speed claim.
