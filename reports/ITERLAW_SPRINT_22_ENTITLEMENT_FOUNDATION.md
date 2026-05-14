# Sprint 22 — Entitlement and subscription module-access foundation

## Verdict: PASS

Foundation only. Types + pure policy function. No payment provider. No live billing. No customer data. No DB migration. No wiring into `handleLegalRequest`. 11 vitest cases.

## Files

- `apps/legal-orchestrator/src/entitlements/entitlement.types.ts` (new).
- `apps/legal-orchestrator/src/entitlements/entitlementPolicy.ts` (new).
- `apps/legal-orchestrator/src/entitlements/index.ts` (new).
- `apps/legal-orchestrator/src/tests/entitlementPolicy.test.ts` (new — 11 cases).
- `docs/iterlaw/architecture/ITERLAW_ENTITLEMENT_AND_SUBSCRIPTION_MODEL.md` (new).
- `docs/iterlaw/project/12-entitlements/ENTITLEMENT_FOUNDATION.md` (new).

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/entitlementPolicy.test.ts
 ✓ src/tests/entitlementPolicy.test.ts (11 tests) 10ms
TEST_EXIT=0
```

## Decision contract

`checkEntitlement({workspaceId, moduleId, entitlements, nowIsoDate})` returns one of:

- `{ ok: true, entitlement, reasonCodes }`
- `{ ok: false, reason: "module_not_active" | "module_not_registered" | "no_entitlement_for_module" | "entitlement_status_not_active" | "entitlement_not_yet_granted" | "entitlement_expired", reasonCodes }`

The function takes `nowIsoDate` as input — no implicit `new Date()` call — keeping it deterministic and trivially testable.

## Production gate impact

None. Architectural / foundation progress only.

## What this sprint does NOT do

- Does **not** integrate Stripe / any payment provider.
- Does **not** read live billing state.
- Does **not** access customer or PII data.
- Does **not** add a DB migration or schema.
- Does **not** wire `checkEntitlement` into `handleLegalRequest`.
- Does **not** call any LLM.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
