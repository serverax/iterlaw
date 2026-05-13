# Sprint 18 — Law Module Engine Foundation Report

## STATUS: PASS

Read-only registry of `(jurisdiction, law area)` legal modules is in place. UK Employment is the **only** active module. All eight planned UK modules (Housing / Immigration / Benefits / Debt / Consumer / Family / Business-Contract / Tax) are explicitly declared `status: "planned"` and are refused for answer generation by `requireActiveModule(...)`. Tests, typecheck, build, lint all PASS. No false claim of multi-module capability. Registry is not wired into the live answer path by this sprint.

---

## 1. Files added

| File | Role |
|---|---|
| `apps/legal-orchestrator/src/lawModuleEngine/legalModule.types.ts` | Types: `LawModule`, `LawJurisdiction`, `LawArea`, `LawModuleStatus`, `SourceTier`, `CitationPolicy`, `TemporalPolicy`, `LawModuleLookupKey`, `LawModuleLookupResult`, `LawModuleLookupError`. |
| `apps/legal-orchestrator/src/lawModuleEngine/legalModuleRegistry.ts` | Frozen registry. `listModules`, `listActiveModules`, `findById`, `findByScope`, `lookupModule`, `requireActiveModule`. No mutation API. |
| `apps/legal-orchestrator/src/lawModuleEngine/ukEmploymentModule.ts` | Active `uk_employment` (jurisdiction `UK_ENGLAND_WALES`, lawArea `employment`, 5 source tiers, `minSourceTierForAnswer: 4`, temporal effective-date min 1996-01-01). |
| `apps/legal-orchestrator/src/lawModuleEngine/plannedModules.ts` | Eight planned UK modules. |
| `apps/legal-orchestrator/src/lawModuleEngine/index.ts` | Public surface. |
| `apps/legal-orchestrator/src/tests/legalModuleRegistry.test.ts` | 12 vitest cases. |
| `docs/iterlaw/architecture/ITERLAW_LAW_MODULE_ENGINE_ARCHITECTURE.md` | Architecture doc. |
| `docs/iterlaw/project/08-law-modules/LAW_MODULE_ENGINE_FOUNDATION.md` | Sprint 18 record. |
| `reports/ITERLAW_SPRINT_18_LAW_MODULE_ENGINE_FOUNDATION.md` | This report. |

## 2. Design decision: separate from `src/modules/`

The existing `apps/legal-orchestrator/src/modules/` directory already hosts the per-request module pipeline (`ruleEngine`, `citationVerifier`, `deadlineChecker`, `piiRedactor`, `policyGate`, plus `legal-packs/uk_employment.ts`). To avoid clobbering that surface, the Sprint 18 registry is placed under `apps/legal-orchestrator/src/lawModuleEngine/`. The two layers compose: the registry tells the answer path *which* `(jurisdiction, law area)` is active; the pipeline runs the per-request safety steps *inside* that module. This decision is recorded in the architecture doc.

## 3. Acceptance gates (test evidence)

`npx vitest run src/tests/legalModuleRegistry.test.ts` — **12 tests / 1 file PASS** (exit 0). Tests verify:

- UK Employment is the only active module (`listActiveModules()` length 1).
- Every planned UK module is `status: "planned"`.
- Housing / Immigration / Benefits / Debt / Consumer / Family / Business-Contract / Tax are all explicitly **planned**, never active.
- `requireActiveModule(...)` rejects every non-active module with `error.kind === "inactive_module"`.
- `requireActiveModule({ moduleId: "uk_employment" })` accepts.
- Every module enforces `citationRequired: true` + `zeroCitationAnswerBlocked: true`.
- Every module has at least one answer-granting source tier.
- Every module's temporal policy excludes superseded sources.
- `lookupModule({ moduleId: "nonexistent_module_xyz" })` returns `unknown_module`.
- `lookupModule({ moduleId: "" })` returns `invalid_lookup_key`.
- `lookupModule({ jurisdiction: "UK_ENGLAND_WALES", lawArea: "employment" })` finds `uk_employment`.
- `UK_EMPLOYMENT_MODULE` exposes the expected namespaces and tiers.

## 4. QA results (full suites)

```
$ npm run typecheck                              →   exit 0
$ npm run lint                                   →   exit 0 ("✔ No ESLint warnings or errors")
$ npm test                                       →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm run typecheck →   exit 0
$ cd apps/legal-orchestrator && npm run build    →   exit 0
$ cd apps/legal-orchestrator && npm test         →   74 files / 924 tests PASS    exit 0   (+1 file / +12 tests from Sprint 18)
```

No regressions. Vitest suite grew from 73 / 912 to **74 / 924** (the new Sprint 18 file contributes 12 tests).

## 5. What was deliberately NOT done

- Registry is **not** wired into `handleLegalRequest`. A separate sprint (Sprint 18.x) will integrate `requireActiveModule(...)` behind a feature flag.
- No new DB schema added. The registry is in-memory only.
- No content ingestion for any planned module.
- No entitlement / subscription enforcement.
- No production deployment.

## 6. Status doc updates

- `docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md` is unaffected by this report (the gap-list already prioritised Sprint 18 as a roadmap item; this sprint executes the foundation only).
- Active sprint counts in `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` are not changed by this sprint (Sprint 18 is foundation-only; no PASS-for-scope flag in the headline counts yet).

## 7. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- No fake module activation. Only `uk_employment` is active; eight UK modules are explicitly planned and refused by the registry.
- Test suite grew from 73/912 to 74/924 vitest tests; root jest unchanged at 41/185.

## 8. Sprint 18 verdict

**STATUS: PASS** for the named "foundation" scope. Registry + types + tests in place; UK Employment active; all other UK modules explicitly planned; QA green; no false production claim.
