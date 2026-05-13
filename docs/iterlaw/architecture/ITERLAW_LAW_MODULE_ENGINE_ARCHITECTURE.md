# IterLaw Law Module Engine Architecture

> **Foundation only.** UK Employment is the **only** active legal module. Every other module declared here is **PLANNED** and is **refused** by the registry for legal-answer generation. This document does **not** claim multi-jurisdiction or multi-domain support is implemented.

Implementation files:

- `apps/legal-orchestrator/src/lawModuleEngine/legalModule.types.ts` — types only.
- `apps/legal-orchestrator/src/lawModuleEngine/legalModuleRegistry.ts` — pure read-only registry; `requireActiveModule(...)` is the helper the answer path uses.
- `apps/legal-orchestrator/src/lawModuleEngine/ukEmploymentModule.ts` — UK Employment (active).
- `apps/legal-orchestrator/src/lawModuleEngine/plannedModules.ts` — UK Housing, Immigration, Benefits, Debt, Consumer, Family, Business/Contract, Tax — all PLANNED.
- `apps/legal-orchestrator/src/lawModuleEngine/index.ts` — public surface.
- `apps/legal-orchestrator/src/tests/legalModuleRegistry.test.ts` — 12 tests.

Naming note: the existing `apps/legal-orchestrator/src/modules/` directory hosts the **per-request module pipeline** (rule engine, citation verifier, deadline checker, PII redactor, etc.). The Sprint 18 **registry/engine** is a different layer and is placed under `src/lawModuleEngine/` to avoid clobbering. The two layers compose as follows: the registry tells the answer path which `(jurisdiction, law area)` is active; the pipeline runs the per-request safety steps inside that module.

---

## 1. What a law module is

A law module is a `(jurisdiction, law area)` cell with its own:

- **RAG namespace** — `iterlaw:rag:<module_id>`. No cross-module retrieval on the answer path.
- **Rules namespace** — `iterlaw:rules:<module_id>`. Deterministic calculators / rule packs.
- **Templates namespace** — `iterlaw:templates:<module_id>`. Document templates.
- **Source tiers** — ordered list with `grantsAnswer: boolean`. Lower-tier content may be retrieved but cannot ground an answer.
- **Citation policy** — `citationRequired: true`, `zeroCitationAnswerBlocked: true`, plus `minSourceTierForAnswer`.
- **Temporal policy** — `excludeSuperseded: true` by default; opt-in `allowHistoricalComparison` for explicit historical mode.
- **Status** — `"active"`, `"planned"`, or `"inactive"`. **Only `"active"` may ground an answer.**

These are explicit, code-level types in `legalModule.types.ts`.

## 2. Registry contract

`legalModuleRegistry` exposes:

- `listModules()` — every registered module.
- `listActiveModules()` — only `status === "active"`.
- `findById(moduleId)` — direct lookup or `undefined`.
- `findByScope(jurisdiction, lawArea)` — every module matching the scope.
- `lookupModule(key)` — typed `{ ok, module } | { ok: false, error: { kind, reason } }`.
- `requireActiveModule(key)` — same as `lookupModule` but refuses any non-active module with `error.kind === "inactive_module"`. **This is the helper the answer path uses.**

Error kinds: `"unknown_module"`, `"inactive_module"`, `"invalid_lookup_key"`, `"ambiguous_match"`.

The registry is frozen with `Object.freeze` and exposes no mutation API.

## 3. Active module: UK Employment

`uk_employment`:

- jurisdiction: `UK_ENGLAND_WALES`.
- law area: `employment`.
- source tiers (1 = primary legislation, 4 = official guidance, 5 = commentary — non-grounding).
- `minSourceTierForAnswer: 4` — guidance + above can ground answers.
- temporal policy: `excludeSuperseded: true`, `effectiveDateMin: "1996-01-01"`.

Scope is explicitly **England & Wales** only. Scottish and Northern Irish employment law are intentionally **not** in scope of `uk_employment`; they are deferred to future modules.

## 4. Planned modules (not active)

| moduleId | jurisdiction | lawArea | status |
|---|---|---|---|
| `uk_housing` | UK_ENGLAND_WALES | housing | planned |
| `uk_immigration` | UK | immigration | planned |
| `uk_benefits` | UK | benefits | planned |
| `uk_debt` | UK_ENGLAND_WALES | debt | planned |
| `uk_consumer` | UK | consumer | planned |
| `uk_family` | UK_ENGLAND_WALES | family | planned |
| `uk_business_contract` | UK_ENGLAND_WALES | business_contract | planned |
| `uk_tax` | UK | tax | planned |

All eight are explicitly **planned**. None can ground a legal answer. Tests in `legalModuleRegistry.test.ts` assert this.

## 5. Subscription / entitlement compatibility (future)

The registry shape supports a future subscription layer: a per-tenant entitlement table can map a user to one or more `moduleId`s. The registry stays pure and read-only; entitlement enforcement is a layer above. No code or schema for entitlement is added in Sprint 18.

## 6. What this sprint does NOT do

- Does **not** add a new database schema for modules.
- Does **not** activate any module beyond `uk_employment`.
- Does **not** wire the registry into `handleLegalRequest` (foundation only; wiring is a future sprint after the registry is reviewed and a clear answer-path integration plan is approved).
- Does **not** ingest content for any planned module.

## 7. Test contract

See `apps/legal-orchestrator/src/tests/legalModuleRegistry.test.ts`. 12 tests cover:

- UK Employment is the only active module.
- Every other listed module is planned, not active.
- `requireActiveModule` rejects every non-active module with `"inactive_module"`.
- `requireActiveModule` accepts UK Employment.
- Every module has `citationRequired: true` and `zeroCitationAnswerBlocked: true`.
- Every module has at least one answer-granting source tier.
- Every module's temporal policy excludes superseded sources.
- `lookupModule` returns `"unknown_module"` for a missing id.
- `lookupModule` returns `"invalid_lookup_key"` for an empty id.
- `lookupModule` finds UK Employment by `(UK_ENGLAND_WALES, employment)`.
- UK_EMPLOYMENT_MODULE namespaces + tiers are as declared.
