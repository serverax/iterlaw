# Sprint 18 — Law Module Engine Foundation

> **Status: PASS for foundation only.** UK Employment is the only active module. No module is wired into the live answer path yet. This is not a production capability.

Cross-reference: [`docs/iterlaw/architecture/ITERLAW_LAW_MODULE_ENGINE_ARCHITECTURE.md`](../../architecture/ITERLAW_LAW_MODULE_ENGINE_ARCHITECTURE.md).

## What landed

- Types: `apps/legal-orchestrator/src/lawModuleEngine/legalModule.types.ts`.
- Registry: `apps/legal-orchestrator/src/lawModuleEngine/legalModuleRegistry.ts`.
- UK Employment module (active): `apps/legal-orchestrator/src/lawModuleEngine/ukEmploymentModule.ts`.
- Eight planned modules (UK Housing / Immigration / Benefits / Debt / Consumer / Family / Business-Contract / Tax): `apps/legal-orchestrator/src/lawModuleEngine/plannedModules.ts`.
- Index: `apps/legal-orchestrator/src/lawModuleEngine/index.ts`.
- Tests: `apps/legal-orchestrator/src/tests/legalModuleRegistry.test.ts` — 12 tests PASS.

## Acceptance

- Registry returns exactly **one** active module: `uk_employment`.
- All eight planned modules are explicitly `status: "planned"` and are refused by `requireActiveModule(...)` with `error.kind === "inactive_module"`.
- Every module enforces `citationRequired: true` and `zeroCitationAnswerBlocked: true`.
- Lookups by moduleId or `(jurisdiction, lawArea)` return typed `{ ok, module } | { ok: false, error }` values.
- Invalid lookups return `"unknown_module"` or `"invalid_lookup_key"` (never throw).
- `npm run typecheck`, `npm run build`, `npm test` all exit 0.

## What this does NOT claim

- No new database schema.
- No module is wired into `handleLegalRequest`.
- No content ingested for planned modules.
- No multi-jurisdiction or multi-domain answer capability.
- No production deployment.

## Next steps (future sprints)

- Sprint 18.x — integrate `legalModuleRegistry.requireActiveModule(...)` into `handleLegalRequest`'s preflight, with feature-flag opt-in.
- Sprint 18.y — add database migration for per-tenant entitlement (`tenant_id -> moduleId[]`), behind a separate flag.
- Sprint 18.z — UK Employment ingestion pack: source pinning, citation registry, statutory rate calculators alignment with `legal-packs/uk_employment`.
