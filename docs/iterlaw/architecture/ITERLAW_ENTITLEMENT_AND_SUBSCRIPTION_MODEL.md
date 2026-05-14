# IterLaw Entitlement and Subscription Model (foundation)

> Foundation only. **No payment provider is integrated. No billing logic runs. No customer data is read.** Sprint 22 ships types + a pure policy function that downstream wiring sprints can call.

## Concepts

- **Workspace** — the tenant boundary every answer is scoped to.
- **Law module** — a `(jurisdiction, lawArea)` cell in the registry (e.g. `uk_employment`). Defined by Sprint 18 — see [`docs/iterlaw/architecture/ITERLAW_LAW_MODULE_ENGINE_ARCHITECTURE.md`](./ITERLAW_LAW_MODULE_ENGINE_ARCHITECTURE.md).
- **Entitlement** — an opaque record `{ workspaceId, moduleId, grantedAt, expiresAt, status }` issued by the operator (or, eventually, a billing system) to a workspace, granting access to a specific module for a window.

The orchestrator never reads payment-provider state directly. The caller (HTTP layer, scheduled job, admin tool) is responsible for converting billing state into entitlement records.

## Files

- `apps/legal-orchestrator/src/entitlements/entitlement.types.ts` — `WorkspaceEntitlement`, `EntitlementStatus`.
- `apps/legal-orchestrator/src/entitlements/entitlementPolicy.ts` — `checkEntitlement(input)` pure function.
- `apps/legal-orchestrator/src/entitlements/index.ts` — public re-export.
- `apps/legal-orchestrator/src/tests/entitlementPolicy.test.ts` — 11 vitest cases.

## Decision contract

`checkEntitlement(input)` returns one of:

- `{ ok: true, entitlement, reasonCodes }` — workspace may use the module.
- `{ ok: false, reason, reasonCodes }` where `reason` is one of:
  - `module_not_active`
  - `module_not_registered`
  - `no_entitlement_for_module`
  - `entitlement_status_not_active`
  - `entitlement_not_yet_granted`
  - `entitlement_expired`

All decisions carry a `reasonCodes` array suitable for telemetry / audit envelopes.

## Rules

1. Module must exist in the law-module registry.
2. Module must be `status: "active"`. Planned / inactive modules are refused with reason `module_not_active`.
3. At least one entitlement must match `(workspaceId, moduleId)`.
4. The matching entitlement must have `status === "active"`. `"expired"` short-circuits with `entitlement_expired`; `"inactive"` or `"pending"` records skip until a better candidate is found, otherwise refused with `entitlement_status_not_active`.
5. Current date (caller-supplied — `nowIsoDate`) must be within `[grantedAt, expiresAt]`. `expiresAt: null` = open-ended.

The function takes `nowIsoDate` as input rather than calling `new Date()` — this keeps the function pure and deterministic and makes time-travel tests easy.

## Out of scope (deliberately)

- No payment provider call.
- No live billing state read.
- No customer or PII access.
- No DB schema (`tenant_id → module_id[]` table). The caller passes the entitlement snapshot.
- No HTTP wiring into `handleLegalRequest`. A future sprint can place `checkEntitlement` ahead of the law-module routing gate.
- No `network`, no `LLM`, no production-state read.

## Next steps

- Sprint 22.x — DB schema for per-tenant entitlement, migration, and a loader that the orchestrator can call.
- Sprint 22.y — Wire `checkEntitlement` into `handleLegalRequest` behind a feature flag (default OFF). **DONE** in Sprint 30.

## Sprint 30 — wired into `handleLegalRequest`

`runEntitlementGate(input)` (the orchestrator-shape adapter at `apps/legal-orchestrator/src/entitlements/entitlementGateAdapter.ts`) is invoked behind `ITERLAW_ENTITLEMENT_GATE_ENABLED` (default OFF). Placed **ahead** of the Sprint 18A law-module-routing block.

Without an injected `loader` the gate records `entitlement_gate:no_loader` and returns — the legacy answer path is unchanged. With a loader, the gate runs `checkEntitlement` from Sprint 22 and surfaces the structured decision trace.

10 vitest cases at `apps/legal-orchestrator/src/tests/entitlementGateAdapter.test.ts` prove:

- Flag default OFF; parses canonical truthy / falsy strings.
- No loader → `no_loader_configured`.
- Active UK Employment entitlement → allowed.
- Planned-module entitlement → `module_not_active`.
- Workspace with no entitlement → `no_entitlement_for_module`.
- Expired entitlement → `entitlement_expired`.
- Inactive entitlement → refused.
- Allow path records `entitlement:ok` in the trace.
- Loader throw → swallowed; `loader_error` reported.
