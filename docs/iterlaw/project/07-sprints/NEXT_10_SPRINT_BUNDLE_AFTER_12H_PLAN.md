# IterLaw — Next 10-Sprint Bundle After Sprint 12H / 18A / 19A / 20 / 12J

**Baseline:** HEAD `b7af17f` on `origin/master`. Working tree clean. Production readiness: NO (12 / 17 gates PASS). Local / code testing readiness: YES.

**Scope:** Plan only. This document does **not** authorise execution. It is the contract under which the bundle will be executed in a later, explicitly-authorised session.

## Hard rules carried into every sprint of this bundle

1. No fake PASS. PASS only when acceptance criteria are met. PARTIAL only with exact blocker evidence. FAIL on wrong project, broken tests, unsafe action, unsupported claim, or duplicate work.
2. No deploy. No `kubectl apply / delete / patch`. No `helm upgrade`. No production DB mutation.
3. No `npm audit fix --force`.
4. No external LLM call. No `api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai` — denied by `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts`.
5. No secrets read, printed, or committed.
6. No `git push --force`. No git history rewrite.
7. Master / control-plane IP is **138.201.253.56**. `138.201.253.245` is in the deny list and must stay there.
8. Working only in `C:\Users\kalsh\projects\iterlaw`. `D:\AI agent agency` and `F:\rahma` are out of scope.
9. QA cadence: `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` at repo root; `npm run typecheck` + `npm run build` + `npm test` inside `apps/legal-orchestrator`. After every sprint or coherent group.
10. Each sprint commits its own report under `reports/`. Commit only after successful tests. Push only after successful commit and clean status.

## Bundle order (10 sprints)

1. **Sprint 12K** — Operator evidence refresh for G09 / G10 / G11.
2. **Sprint 20A** — Wire ingestion policy + citation metadata policy into the ingestion pipeline.
3. **Sprint 19B** — Postgres retrieval adapters + local benchmark readiness.
4. **Sprint 21** — Deterministic statutory redundancy pay calculator.
5. **Sprint 12L** — Live backup / restore evidence gate.
6. **Sprint 22** — Entitlement + subscription module-access foundation.
7. **Sprint 23** — Deterministic reranker foundation.
8. **Sprint 24** — Citation verification hardening + evidence-pack builder.
9. **Sprint 25** — Legal golden evaluation harness.
10. **Sprint 26** — Speed-first retrieval phase 1: approved-answer fast path.

After this bundle: numbered sprints 21–26 will be delivered (6 numbered sprints), plus 4 operational / wiring sprints (12K, 20A, 19B, 12L). Numbered remaining after this bundle (if all 6 numbered PASS): **31** (27 → 57).

---

## Sprint 12K — Operator evidence refresh for G09 / G10 / G11

**Objective.** Re-probe whether the operator environment can flip G09 / G10 / G11. If Docker Desktop is up and an SSH agent is authorised, run the existing Sprint 14 + Sprint 15 scripts.

**Files expected.**
- `reports/ITERLAW_SPRINT_12K_OPERATOR_EVIDENCE_FLIPS_G09_G10_G11.md`
- Updates to `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` (refreshed blockers only — no fake flips).
- Updates to `PROJECT.md`, `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md`.

**Tests expected.** No new tests (operator-evidence sprint). QA after run.

**Production gate impact.** Up to +3 (G09, G10, G11) if operator environment allows; else 0 with refreshed blockers.

**Verdict rule.** PASS if all three flip with evidence. PARTIAL if any blocker remains. FAIL on unsafe command or fake evidence.

**Likely remaining blocker.** Docker daemon offline + SSH classifier-denial. Same as Sprint 12F and 12H. This sprint may PARTIAL again — that is honest.

---

## Sprint 20A — Wire ingestion policy + citation metadata policy

**Objective.** Wire the Sprint 20 foundation (`evaluateIngestionPolicy`, `evaluateCitationMetadata`) into the ingestion pipeline as a pre-fetch / pre-persist gate. No live scraping. No DB write.

**Files expected.**
- `apps/legal-orchestrator/src/ingestion/ingestionPipelinePolicyGate.ts` (new — pure function).
- `apps/legal-orchestrator/src/tests/ingestionPipelinePolicyGate.test.ts` (new — vitest).
- Docs: `docs/iterlaw/project/10-ingestion/UK_EMPLOYMENT_INGESTION_PACK_FOUNDATION.md` updated; `docs/iterlaw/architecture/ITERLAW_UK_EMPLOYMENT_SOURCE_REGISTRY.md` updated.
- `reports/ITERLAW_SPRINT_20A_INGESTION_POLICY_GATE_WIRING.md`.

**Tests expected.** Allowlisted official source with complete metadata = allowed; missing effective date on legal source = `needs_review`; unknown hostname = blocked; non-https = blocked; missing source_url / source_title = blocked; reason codes included; no fetch / axios / http / network / LLM.

**Production gate impact.** None directly. Architectural progress only.

**Verdict rule.** PASS if gate enforced + tests + QA clean. PARTIAL if gate exists but not wired. FAIL on broken tests or live scrape.

---

## Sprint 19B — Postgres retrieval adapters + local benchmark readiness

**Objective.** Provide `fullTextSearch` / `vectorSearch` adapters that delegate to existing `apps/legal-orchestrator/src/rag/postgresRetrieval.ts` primitives, with safe fallback when no DB is configured. Expand the existing mock benchmark harness to include a real-Postgres mode gated by `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true`.

**Files expected.**
- `apps/legal-orchestrator/src/retrieval/postgresRetrievalAdapters.ts`.
- `apps/legal-orchestrator/src/tests/postgresRetrievalAdapters.test.ts`.
- `scripts/bench/iterlaw-retrieval-benchmark.mjs` updated.
- Docs updated: `docs/iterlaw/architecture/ITERLAW_MULTI_TIER_RETRIEVAL_ENGINE.md`, `docs/iterlaw/project/09-retrieval/MULTI_TIER_RETRIEVAL_FOUNDATION.md`, `docs/iterlaw/project/09-retrieval/RETRIEVAL_BENCHMARK_HARNESS.md`.
- `reports/ITERLAW_SPRINT_19B_POSTGRES_RETRIEVAL_ADAPTERS_AND_BENCH.md`.

**Tests expected.** Adapter returns empty result when DB config absent (no throw); benchmark runs in mock mode by default; real-Postgres mode short-circuits on missing env. **No real DATABASE_URL printed.**

**Production gate impact.** None. Architectural progress only.

**Verdict rule.** PASS if adapter + bench + tests + QA clean. PARTIAL if adapter present but bench mock-only and that is intentionally documented. FAIL on production DB dependency or fake speed claim.

---

## Sprint 21 — Deterministic statutory redundancy pay calculator

**Objective.** Implement the first IterLaw statutory calculator: UK redundancy pay. Pure deterministic function. No LLM. No DB. No fake source. Refuse with `needs_verified_rate` when statutory cap source is not provided.

**Files expected.**
- `apps/legal-orchestrator/src/legalRules/redundancyPayCalculator.ts`.
- `apps/legal-orchestrator/src/legalRules/statutoryRates.ts` (versioned rate-history loader — no live network).
- `apps/legal-orchestrator/src/tests/redundancyPayCalculator.test.ts`.
- `docs/iterlaw/project/11-calculators/STATUTORY_REDUNDANCY_PAY_CALCULATOR.md`.
- `docs/iterlaw/architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md` updated.
- `reports/ITERLAW_SPRINT_21_STATUTORY_REDUNDANCY_CALCULATOR.md`.

**Tests expected.** Rules (already locked in by ERA 1996 s162): under 22 → 0.5 week per full year; 22–40 → 1 week per full year; 41+ → 1.5 weeks per full year; service capped at 20 years; weekly pay capped by statutory weekly-pay cap (rate must come from the rate file, not hard-coded into the calculator); full years only; result includes `assumptions`, `warnings`, `reason_codes`. Missing verified rate → `{ ok: false, reason: "needs_verified_rate" }`.

**Production gate impact.** Flips `statutoryRedundancyPay` from `planned` → `implemented` inside `statutoryCalculatorRegistry`.

**Verdict rule.** PASS if calculator + rate loader + tests + QA clean. PARTIAL if rate cap unsourced (then returns `needs_verified_rate`). FAIL on LLM dependency or hard-coded year-by-year tables.

---

## Sprint 12L — Live backup / restore evidence gate

**Objective.** Add a gate script that flips G12 / G13 in `PRODUCTION_READINESS_GATE.json` only when the existing evidence-validator script has validated the redacted backup + restore evidence files and the gate inputs are explicitly approved.

**Files expected.**
- `scripts/operator/apply-live-backup-restore-evidence-gate.ps1` with parameters `-BackupEvidencePath -RestoreEvidencePath -GateJsonPath -DryRun`.
- `reports/ITERLAW_SPRINT_12L_LIVE_BACKUP_RESTORE_EVIDENCE_GATE.md`.
- Docs updated: `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_EXECUTION_READINESS_CHECKLIST.md`, `LIVE_BACKUP_RESTORE_RUNBOOK.md`, `docs/iterlaw/project/PRODUCTION_READINESS_GATE.md`, `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json`.

**Tests expected.** Operator-evidence sprint — no unit tests required, but the script itself must refuse missing files, refuse a failing validator, refuse evidence whose status is not PASS, and in `-DryRun` mode print the planned JSON delta without writing anything.

**Production gate impact.** None until an operator supplies validated redacted evidence; the gate-flip is a one-line operator action gated by this script.

**Verdict rule.** PASS if script + dry-run prints diff + missing-evidence refusal + docs + QA clean. PARTIAL if script present but DryRun-only. FAIL on writes without operator approval or on secret leakage.

---

## Sprint 22 — Entitlement + subscription module-access foundation

**Objective.** Foundation only. Per-workspace / per-module entitlement type + policy function. No payment provider integration. No live customer data. No DB migration.

**Files expected.**
- `docs/iterlaw/architecture/ITERLAW_ENTITLEMENT_AND_SUBSCRIPTION_MODEL.md`.
- `docs/iterlaw/project/12-entitlements/ENTITLEMENT_FOUNDATION.md`.
- `apps/legal-orchestrator/src/entitlements/entitlement.types.ts`.
- `apps/legal-orchestrator/src/entitlements/entitlementPolicy.ts`.
- `apps/legal-orchestrator/src/entitlements/index.ts`.
- `apps/legal-orchestrator/src/tests/entitlementPolicy.test.ts`.
- `reports/ITERLAW_SPRINT_22_ENTITLEMENT_FOUNDATION.md`.

**Tests expected.** UK Employment allowed by default for fixture workspace; planned modules denied; expired entitlement denied; reason codes included; no DB / network / LLM.

**Production gate impact.** None. Architectural progress.

**Verdict rule.** PASS if types + policy + tests + QA clean. PARTIAL if types present without policy enforcement. FAIL on payment integration or live billing.

---

## Sprint 23 — Deterministic reranker foundation

**Objective.** Replace the Sprint 19 reranker placeholder with a deterministic, score-based reranker. No external reranker model. No external LLM. No fake relevance claim.

**Files expected.**
- `docs/iterlaw/architecture/ITERLAW_RERANKER_POLICY.md`.
- `docs/iterlaw/project/09-retrieval/RERANKER_FOUNDATION.md`.
- `apps/legal-orchestrator/src/retrieval/reranker.ts`.
- `apps/legal-orchestrator/src/tests/rerankerPolicy.test.ts`.
- `reports/ITERLAW_SPRINT_23_RERANKER_FOUNDATION.md`.

**Score factors.** Trust score, freshness, exact match boost, source tier, jurisdiction match, law area match, citation metadata completeness, stale penalty, low-trust penalty.

**Tests expected.** Reranker is wired into multi-tier retrieval **only when `ITERLAW_RERANKER_ENABLED` is true**. Default OFF — flag-default-OFF tests.

**Production gate impact.** None. Architectural progress.

**Verdict rule.** PASS if reranker + flag + tests + QA clean. PARTIAL if reranker present but not wired. FAIL on external model call or fake quality claim.

---

## Sprint 24 — Citation verification hardening + evidence-pack builder

**Objective.** Strengthen the existing citation verifier and emit a structured evidence pack alongside every answer that has citations. No uncited legal claim. No source = blocked. Stale source = blocked unless historical mode. Weak source = `needs_review`.

**Files expected.**
- `apps/legal-orchestrator/src/citations/evidencePack.types.ts`.
- `apps/legal-orchestrator/src/citations/evidencePackBuilder.ts`.
- `apps/legal-orchestrator/src/citations/citationVerifier.ts` (updated or new module that wraps existing verifier behaviour).
- `apps/legal-orchestrator/src/tests/evidencePackAndCitationVerifier.test.ts`.
- `docs/iterlaw/architecture/ITERLAW_CITATION_VERIFICATION_AND_EVIDENCE_PACKS.md`.
- `reports/ITERLAW_SPRINT_24_CITATION_EVIDENCE_PACK_HARDENING.md`.

**Pack fields.** `source_id`, `source_title`, `source_url`, `source_type`, `effective_from`, `effective_to`, `trust_score`, `chunk_id`, `claim_supported`, `citation_status`, `warnings`, `reason_codes`.

**Production gate impact.** None directly — but tightens G15 evidence and prepares for the public-facing citations contract.

**Verdict rule.** PASS if verifier + builder + tests + QA clean. PARTIAL if builder present but verifier untouched. FAIL on relaxed citation gate.

---

## Sprint 25 — Legal golden evaluation harness

**Objective.** Deterministic golden harness for UK Employment scenarios. No external LLM. No fake legal correctness. If citation/evidence is missing, expected result is `insufficient_sources`.

**Files expected.**
- `docs/iterlaw/project/13-evaluation/LEGAL_GOLDEN_TEST_HARNESS.md`.
- `apps/legal-orchestrator/src/evaluation/legalGoldenHarness.ts`.
- `apps/legal-orchestrator/src/tests/fixtures/legalGoldenScenarios.ts`.
- `apps/legal-orchestrator/src/tests/legalGoldenHarness.test.ts`.
- `reports/ITERLAW_SPRINT_25_LEGAL_GOLDEN_EVALUATION_HARNESS.md`.

**Scenario coverage.** Unfair dismissal, redundancy, discrimination, holiday pay, notice pay, settlement agreement, whistleblowing, employment status, ACAS early conciliation, limitation dates. Each scenario has a fixed expected outcome under defined inputs; non-cited paths must return `insufficient_sources`.

**Production gate impact.** None directly — but unlocks honest regression-tracking for legal correctness.

**Verdict rule.** PASS if harness + 10 scenarios + tests + QA clean. PARTIAL if harness present with < 10 scenarios. FAIL on fake "legally correct" oracle.

---

## Sprint 26 — Speed-first retrieval phase 1: approved-answer fast path

**Objective.** Add the foundation for the Tier 0 approved-answer fast path. Deterministic normalised question key. Workspace / project / module / jurisdiction / law area included in the key. Stale / failed / uncited cache rejected. No production speed claim — the harness must benchmark only against the mock + (optional) local Postgres modes.

**Files expected.**
- `docs/iterlaw/project/09-retrieval/SPEED_FIRST_RETRIEVAL_PHASE_1.md`.
- `apps/legal-orchestrator/src/retrieval/approvedAnswerFastPath.ts`.
- `apps/legal-orchestrator/src/retrieval/retrievalCacheKey.ts`.
- `apps/legal-orchestrator/src/tests/approvedAnswerFastPath.test.ts`.
- `scripts/bench/iterlaw-retrieval-benchmark.mjs` updated with a fast-path mock scenario.
- `reports/ITERLAW_SPRINT_26_SPEED_FIRST_RETRIEVAL_PHASE_1.md`.

**Production gate impact.** None directly. Architectural progress.

**Verdict rule.** PASS if fast path + key normalisation + tests + bench scenario + QA clean. PARTIAL if path exists but caches are not invalidated on stale / failed answers (must be fixed before PASS). FAIL on production speed claim or live-cache write that bypasses citation gates.

---

## QA contract for the bundle

After each sprint (or coherent group), the following must pass exit 0:

```
npm run typecheck
npm run lint
npm run build
npm test

(cd apps/legal-orchestrator && npm run typecheck && npm run build && npm test)
```

At the end of the bundle, the following must be re-run and recorded:

```
npm audit --omit=dev                                  must remain 0 vulnerabilities (G08 stays PASS)
npm audit                                             dev-only vulnerabilities allowed; record exact count
node scripts/verify-production-readiness-gate.mjs     record gates_passing / gates_failing and exit code
```

## Final summary file expected

```
reports/ITERLAW_NEXT_10_SPRINT_BUNDLE_12K_20A_19B_21_12L_22_23_24_25_26_SUMMARY.md
```

The summary must record bundle verdict, per-sprint status / commit / push, full QA results, npm audit result, production-readiness gate result, remaining blockers, production readiness YES/NO, how many sprints remain after this bundle, whether system is ready for local / code testing and production / live testing, and the next 10-sprint bundle recommendation.

## Truth statement carried by every sprint in this bundle

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deployment performed.
- No `kubectl` mutating command performed.
- No production DB touched (unless an explicit operator-approved live backup / restore evidence flow is executed under Sprint 12K or 12L — and even then, evidence must be redacted before commit).
- No `git push --force`.
- No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call.
- No secrets read, printed, or committed.
