# Entitlement Foundation (Sprint 22)

**Status:** PASS (foundation; no live billing).

## What this sprint delivered

- `apps/legal-orchestrator/src/entitlements/entitlement.types.ts` — types only.
- `apps/legal-orchestrator/src/entitlements/entitlementPolicy.ts` — pure `checkEntitlement` policy function.
- `apps/legal-orchestrator/src/entitlements/index.ts` — public re-export.
- `apps/legal-orchestrator/src/tests/entitlementPolicy.test.ts` — 11 vitest cases.

## What this sprint does NOT do

- No payment provider integration (Stripe / etc.).
- No live billing state read.
- No customer / PII / contact data access.
- No DB migration.
- No HTTP wiring.
- No external LLM.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/entitlementPolicy.test.ts
 ✓ src/tests/entitlementPolicy.test.ts (11 tests) 10ms
 Test Files  1 passed (1)
      Tests  11 passed (11)
TEST_EXIT=0
```

Test coverage:

- UK Employment + active entitlement + open-ended window — allowed (2).
- Planned module (`uk_housing`) — refused with `module_not_active`.
- Unknown moduleId — refused with `module_not_registered`.
- No entitlement for the module — refused with `no_entitlement_for_module`.
- Entitlement with `status: "inactive"` only — refused with `entitlement_status_not_active`.
- Entitlement with `status: "expired"` — refused with `entitlement_expired`.
- Entitlement past `expiresAt` — refused with `entitlement_expired`.
- Entitlement before `grantedAt` — refused with `entitlement_not_yet_granted`.
- Entitlement for a different workspace — refused with `no_entitlement_for_module`.
- 100 synchronous invocations confirm no IO.

## Architecture cross-reference

[`docs/iterlaw/architecture/ITERLAW_ENTITLEMENT_AND_SUBSCRIPTION_MODEL.md`](../../architecture/ITERLAW_ENTITLEMENT_AND_SUBSCRIPTION_MODEL.md).

## Sprint 30 follow-up

Sprint 30 wires the entitlement gate into `handleLegalRequest` behind `ITERLAW_ENTITLEMENT_GATE_ENABLED` (default OFF). See `docs/iterlaw/architecture/ITERLAW_ENTITLEMENT_AND_SUBSCRIPTION_MODEL.md` "Sprint 30 — wired into handleLegalRequest" and `reports/ITERLAW_SPRINT_30_ENTITLEMENT_GATE_WIRING.md`. Adapter at `apps/legal-orchestrator/src/entitlements/entitlementGateAdapter.ts`. 10 vitest cases at `apps/legal-orchestrator/src/tests/entitlementGateAdapter.test.ts`.
