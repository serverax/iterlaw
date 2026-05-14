# Sprint 35 — Per-tenant entitlement DB schema, migration, and loader

## Verdict: PASS

Multi-country, multi-law-module entitlement schema delivered as migration `107_tenant_module_entitlements.sql` (+ `.down.sql`). A pure repository adapter (`createEntitlementLoader`) maps DB rows to the Sprint 22 `WorkspaceEntitlement` type, and the existing entitlement gate fails closed. 15 vitest cases. **No production DB mutation** in this sprint — the migration file is committed for operator-controlled application; the loader is mock-tested.

## Files

- `apps/legal-orchestrator/db/migrations/107_tenant_module_entitlements.sql` — schema (new).
- `apps/legal-orchestrator/db/migrations/107_tenant_module_entitlements.down.sql` — reverse (new).
- `apps/legal-orchestrator/src/entitlements/entitlementRepository.ts` — pure loader adapter (new).
- `apps/legal-orchestrator/src/entitlements/index.ts` — re-export.
- `apps/legal-orchestrator/src/tests/tenantModuleEntitlementsLoader.test.ts` — 15 vitest cases (new).

## Schema highlights

`public.tenant_module_entitlements` columns:

- `entitlement_id` uuid PK (default `gen_random_uuid()`).
- `tenant_id` uuid, `workspace_id` uuid — both recorded so deployments can decouple them.
- `country` text — ISO-style jurisdiction (`UK_ENGLAND_WALES`, `UK_SCOTLAND`, `IE`, ...). Free-form to avoid coupling to a Typescript enum.
- `module_id` text — matches `LawModule.moduleId` (e.g. `uk_employment`, `uk_housing`, ...).
- `status` text with CHECK constraint to `active | inactive | expired | pending`.
- `effective_from` timestamptz NOT NULL; `effective_to` timestamptz nullable.
- Window CHECK: `effective_to IS NULL OR effective_to >= effective_from`.
- `metadata` jsonb — operator-attached non-secret fields.
- Indexes: `(workspace_id, country, module_id)` lookup; `(tenant_id)`; partial `(workspace_id, module_id) WHERE status = 'active'`.

The schema is **reusable across** every planned law module: employment, housing, immigration, benefits, debt, family, consumer, business_contract, tax — and every jurisdiction.

## Loader contract (mock-safe)

`createEntitlementLoader({ fetcher? })` returns `(workspaceId) => Promise<WorkspaceEntitlement[]>`. Behaviour:

- No fetcher → `[]`.
- Empty workspace id → `[]`.
- Fetcher throws (incl. DSN-shaped error) → `[]` (no leak).
- Otherwise → mapped `WorkspaceEntitlement[]` consumable by Sprint 22 `checkEntitlement`.

The fetcher interface is `(workspaceId) => TenantModuleEntitlementRow[]`. The operator's actual `pg` driver is owned upstream — this file imports no `pg`, `node-fetch`, `axios`, `http`, or `https`.

## Test coverage

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/tenantModuleEntitlementsLoader.test.ts
 ✓ src/tests/tenantModuleEntitlementsLoader.test.ts (15 tests) 15ms
TEST_EXIT=0
```

Cases asserted:

- Mock-safe: no fetcher → []; empty workspace id → []; thrown fetcher → [].
- Row mapping: single row → WorkspaceEntitlement; null `effective_to` → null `expiresAt`; multi-row → ordered list.
- Integration with `checkEntitlement` (fail-closed semantics):
  - allowed entitlement → ok.
  - expired entitlement → refused.
  - inactive entitlement → refused.
  - wrong tenant (defensive over-fetch) → refused.
  - wrong country with planned module → refused.
  - wrong module id → refused.
  - missing entitlement → refused.
  - no fetcher → refused.
- Migration files present on disk (up + down).

## Production gate impact

None. The migration is committed but **not applied** to production. A future operator-authorised sprint applies it; this sprint just lays the schema down.

## What this sprint does NOT do

- Does **not** mutate any production DB. Migration committed; not run.
- Does **not** wire the new loader to the entitlement gate yet. Sprint 30's gate stays default-OFF with no loader; a future sprint can inject this loader.
- Does **not** enable RLS on the new table (matches Sprint 104/105 pattern — RLS enablement is its own migration).
- Does **not** invoke any LLM. Does **not** access `process.env`.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- Migration is idempotent: every `CREATE` uses `IF NOT EXISTS`; no DROP/DELETE/TRUNCATE in the up file.
- Loader imports zero connection-management code; the connection is the operator's responsibility.
