# IterLaw Sprint Bundle 12K / 20A / 19B / 21 / 12L / 22 / 23 / 24 / 25 / 26 — Summary

## 1. Bundle verdict: PARTIAL

9 of 10 sprints PASS. Sprint 12K is PARTIAL — same two operator-environment blockers as Sprint 12F and Sprint 12H (Docker Desktop daemon offline + SSH classifier denial for `root@138.201.253.56`). **Net production-readiness movement: 0 new gates flipped.** Production readiness remains NO. **+1 numbered calculator implemented** (statutory redundancy pay, Sprint 21). **+4 deterministic foundations** (ingestion pipeline policy gate, entitlements, reranker, citation evidence packs, golden harness, fast-path tier-0). **+1 operator gate-apply script** (live backup/restore evidence gate, Sprint 12L). **No fake PASS.** **No false claim.** **No external LLM call.** **No secrets committed.**

## 2. Per-sprint status

| Sprint | Scope | Verdict | Commit | Pushed |
|---|---|---|---|---|
| 12K | Operator evidence refresh for G09 / G10 / G11 | **PARTIAL** — Docker daemon offline; SSH classifier-denied. Blocker text on G09 / G10 / G11 refreshed to reference Sprint 12K. | `838740a` | yes |
| 20A | Wire ingestion policy + citation metadata policy into a unified gate | **PASS** — `evaluateIngestionPipelinePolicy(...)` + 10 vitest cases. Pure function, no network, no DB. | `0fa7a1e` | yes |
| 19B | Postgres retrieval adapters + benchmark readiness | **PASS** — `createPostgresFullTextSearch` + `createPostgresVectorSearch` + adapter factory; opt-in local-Postgres bench scenario (`ITERLAW_BENCH_USE_LOCAL_POSTGRES=true`); 10 vitest cases. Vector adapter empty in this sprint (FTS-only port). | `d21f07b` | yes |
| 21 | Deterministic statutory redundancy pay calculator | **PASS** — ERA 1996 s162 implementation; refuses (`needs_verified_rate`) when no statutory cap source supplied; default rates registry ships **EMPTY**; 15 vitest cases. `statutory_redundancy_pay` flipped from `planned` → `implemented` in the calculator registry. | `a1308ac` | yes |
| 12L | Live backup/restore evidence gate | **PASS** — `apply-live-backup-restore-evidence-gate.ps1` validates evidence (DryRun first), refuses missing/secret-shape/non-PASS evidence, only flips G12 + G13 with operator approval. Live backup/restore **NOT EXECUTED**. G12 / G13 unchanged. | `f198f60` | yes |
| 22 | Entitlement + subscription module-access foundation | **PASS** — types + `checkEntitlement` pure policy function; UK Employment allowed by fixture; planned modules denied; expired / pending entitlements refused; 11 vitest cases. No payment provider. No DB. | `7c7fbba` | yes |
| 23 | Deterministic reranker foundation | **PASS** — `rerankCandidates` with 9 deterministic score components; `ITERLAW_RERANKER_ENABLED` default OFF; 13 vitest cases. No external reranker / no LLM. | `5df2d33` | yes |
| 24 | Citation verification hardening + evidence-pack builder | **PASS** — hardened verifier (no source / stale / weak trust gates) + `buildEvidencePack`; 13 vitest cases. Existing `modules/citationVerifier.ts` unchanged. | `e2bc286` | yes |
| 25 | Legal golden evaluation harness | **PASS** — `runLegalGoldenScenarios` + 10 UK Employment scenarios; without injected oracle, every scenario records `insufficient_sources`; 7 vitest cases. | `6818416` | yes |
| 26 | Speed-first retrieval phase 1: approved-answer fast path | **PASS** — deterministic cache key (sha256) + `runApprovedAnswerFastPath`; refuses stale / uncited / failed-QA / non-approved entries; bench harness includes `scenario:fast_path_mock`; 18 vitest cases. **No production speed claim.** | `06f8355` | yes |

## 3. Commits and push results

```
838740a ops(iterlaw): refresh operator evidence for infrastructure gates       (Sprint 12K)
0fa7a1e feat(iterlaw): wire ingestion policy gate                               (Sprint 20A)
d21f07b feat(iterlaw): add postgres retrieval adapters for multi-tier retrieval (Sprint 19B)
a1308ac feat(iterlaw): add statutory redundancy pay calculator                  (Sprint 21)
f198f60 ops(iterlaw): add backup restore evidence gate                          (Sprint 12L)
7c7fbba feat(iterlaw): add entitlement foundation                               (Sprint 22)
5df2d33 feat(iterlaw): add deterministic reranker foundation                    (Sprint 23)
e2bc286 feat(iterlaw): harden citation evidence packs                           (Sprint 24)
6818416 test(iterlaw): add legal golden evaluation harness                      (Sprint 25)
06f8355 feat(iterlaw): add approved answer fast path                            (Sprint 26)
```

All ten pushed to `origin/master`. Local matches remote at each step.

## 4. Full QA results

After the bundle (final cold run against post-Sprint-26 HEAD):

```text
npm run typecheck                                     TYPECHECK_EXIT=0
npm run lint                                          LINT_EXIT=0   (No ESLint warnings or errors)
npm run build                                         BUILD_EXIT=0  (Next.js 15.5.18; 15 routes; post-next-standalone OK)
npm test                                              ROOT_TEST_EXIT=0   (41 suites / 185 tests)

apps/legal-orchestrator npm run typecheck             ORCH_TC_EXIT=0
apps/legal-orchestrator npm run build                 ORCH_BUILD_EXIT=0
apps/legal-orchestrator npm test                      ORCH_TEST_EXIT=0   (86 files / 1076 tests)
```

Orchestrator vitest growth across this bundle:

| Bundle position | Files | Tests |
|---|---|---|
| Entry (post-bundle 12H→12J) | 78 | 978 |
| After Sprint 20A | 79 | 988 |
| After Sprint 19B | 80 | 998 |
| After Sprint 21 | 81 | 1014 |
| After Sprint 12L (no orchestrator code) | 81 | 1014 |
| After Sprint 22 | 82 | 1025 |
| After Sprint 23 | 83 | 1038 |
| After Sprint 24 | 84 | 1051 |
| After Sprint 25 | 85 | 1058 |
| After Sprint 26 | **86** | **1076** |

Net growth: **+8 files / +98 tests**. No regressions.

## 5. npm audit result

```text
npm audit --omit=dev   →   found 0 vulnerabilities                              exit 0
npm audit              →   7 vulnerabilities (4 low, 3 high) — all dev-only:    exit 0
                            jest-environment-jsdom → jsdom → http-proxy-agent → @tootallnate/once
                            eslint-config-next → @next/eslint-plugin-next → glob 10.2-10.4.5
```

`npm audit fix --force` was **not** run.

## 6. Production readiness gate result

```text
node scripts/verify-production-readiness-gate.mjs
schema_version    : 1
last_updated      : 2026-05-13
declared_status   : NO
gates_total       : 17
gates_passing     : 12
gates_failing     : 5
PRODUCTION_GATE_EXIT=1
```

| Gate | Status | Blocker (post-bundle) |
|---|---|---|
| G09 | NOT_VERIFIED | Docker daemon offline (Sprint 12K probe). |
| G10 | NOT_VERIFIED | SSH classifier-denied to `root@138.201.253.56` (Sprint 12K probe). |
| G11 | NOT_VERIFIED | Tied to G10. |
| G12 | PARTIAL | Live backup not authorised. Sprint 12L apply-script added; operator must supply validated redacted evidence. |
| G13 | NOT_VERIFIED | Live restore not authorised. Sprint 12L apply-script added. |

**No new gate flipped in this bundle.** All five remaining blockers are operator-environment dependencies.

## 7. Remaining blockers

| Gate | Operator action |
|---|---|
| G09 | Start Docker Desktop. Set throwaway `ITERLAW_STAGING_PG_*` env vars. Run `scripts/operator/sprint14-docker-staging-migration-replay.ps1`. |
| G10 | Load an SSH agent with an authorised key for `root@138.201.253.56`. Run `scripts/infra/verify-iterlaw-live-readonly.ps1`. |
| G11 | Tied to G10. |
| G12 | Operator drill + redacted evidence + Sprint 12L apply-script DryRun → real run. |
| G13 | Same path against an isolated drill target. |

Architectural items still outstanding (no production impact today):

- Wire `evaluateIngestionPipelinePolicy` into `runIngestionPipeline` (Sprint 20A leaves it exposed).
- Wire `checkEntitlement` ahead of law-module routing (Sprint 22 leaves it exposed).
- Wire `rerankCandidates` into the multi-tier gateway when `ITERLAW_RERANKER_ENABLED` (Sprint 23 leaves it exposed).
- Wire the hardened citation verifier + evidence-pack builder into `handleLegalRequest` (Sprint 24 leaves them exposed).
- Wire `runApprovedAnswerFastPath` ahead of `runMultiTierRetrievalGateway` (Sprint 26 leaves it exposed).
- Populate the `statutoryRates` registry with citeable cap entries so the redundancy calculator can serve numbers (Sprint 21 leaves the registry empty by design).

## 8. Production readiness: NO

Verifier exits 1. 12 of 17 gates PASS; 5 still fail. **No false production-ready claim.**

## 9. Local / code testing readiness: YES

Root + orchestrator typecheck + lint + build + tests all exit 0. `npm audit --omit=dev` reports 0 production vulnerabilities. 1076 orchestrator vitest cases + 185 root jest cases all pass.

## 10. Production / live testing readiness: NO

5 production gates remain. All five are operator-environment dependencies, not code defects.

## 11. How many sprints remain after this bundle

- **Numbered sprints delivered with reports + commits:** **26** (Sprints 1–26).
- **Numbered sprints remaining:** **31** (Sprints 27–57).
- **Operational / wiring sprints delivered alongside (not in the 57 count):** **15** (12A → 12L, 18A, 19A, 19B, 20A).

## 12. Next 10-sprint bundle recommendation

1. **Sprint 12M — Operator-run flip for G09 / G10 / G11.** Pure operator-evidence sprint when Docker Desktop is running and an authorised SSH agent is loaded. Same script set.
2. **Sprint 27 — Wire Sprint 26 approved-answer fast path into `handleLegalRequest`** behind `ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED` (default OFF). Inject an in-memory mock lookup as the dependency until a real Tier-0 store lands.
3. **Sprint 28 — Wire Sprint 23 reranker into `runMultiTierRetrievalGateway`** when `ITERLAW_RERANKER_ENABLED=true`. Re-run the bench harness scenario alongside.
4. **Sprint 29 — Wire Sprint 24 hardened citation verifier + evidence-pack builder ahead of the legacy citation gate** in `handleLegalRequest`. Default-OFF flag.
5. **Sprint 30 — Wire Sprint 22 entitlement gate ahead of law-module routing.** Default-OFF flag. Provide an in-memory fixture entitlement loader; document the DB-schema sprint that follows.
6. **Sprint 31 — Populate `statutoryRates` registry with cited cap entries** for the redundancy calculator under an operator-controlled commit. Source URLs only; values are committed only after citation-metadata-gate validation.
7. **Sprint 32 — Vector adapter for the multi-tier retrieval engine.** Add a real `vectorSearch` capability to the `RetrievalPort` and wire it into `createPostgresVectorSearch`. Document the pgvector index requirement.
8. **Sprint 12N — Operator-run live backup + live restore.** Operator follows the Sprint 12L runbook; DryRuns the apply-script; flips G12 + G13.
9. **Sprint 33 — Second statutory calculator** (notice period or holiday pay) following the Sprint 21 pattern.
10. **Sprint 34 — Sprint 25 golden harness extension** — add evidence-attached scenarios so the oracle has the inputs it needs to produce `answered` outcomes for at least three scenario classes (unfair dismissal, redundancy, notice).

## 13. Updated project MD files

- `PROJECT.md` — rebaseline note + sprint progress block refreshed (Sprints 1–26 delivered; 31 remaining).
- `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` — Sprint count + latest bundle commits added.
- `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` — mirror count refreshed.
- `docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md` — bundle-3 line added.
- `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` — counts refreshed; bundle anchor link added.
- `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` — remaining count refreshed to 31.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No `D:\AI agent agency` access. No `F:\rahma` access.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call.
- No secrets read, printed, or committed.
- Sprint 12K PARTIAL classification reflects two real environment blockers (Docker daemon, SSH classifier denial), unchanged across Sprint 12F → Sprint 12H → Sprint 12K. Not script defects.
- Sprint 21 ships the calculator with an **empty** statutory rates registry by design. Test code uses an illustrative fixture cap labelled as such; product code carries no unsourced rate values.
- Sprint 12L's apply-script was exercised only in DryRun mode against the existing Sprint 12J redacted examples. The gate JSON's G12 and G13 fields remain PARTIAL / NOT_VERIFIED.
- Every sprint that added a feature flag (Sprint 23) defaults to OFF and fails closed.
- Every wired surface remains shadow-only / opt-in / un-wired until a later sprint integrates it under change control.
