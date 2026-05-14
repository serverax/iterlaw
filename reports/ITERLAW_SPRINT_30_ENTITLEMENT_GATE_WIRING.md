# Sprint 30 — Wire entitlement gate ahead of law-module routing

## Verdict: PASS

Sprint 22 entitlement policy now invoked from `handleLegalRequest` behind `ITERLAW_ENTITLEMENT_GATE_ENABLED` (default OFF). Placed **ahead** of the Sprint 18A law-module routing block. Shadow-mode telemetry only. 10 vitest cases. No payment provider. No DB. No network. No external LLM.

## Files

- `apps/legal-orchestrator/src/entitlements/entitlementGateAdapter.ts` (new).
- `apps/legal-orchestrator/src/entitlements/index.ts` — re-export.
- `apps/legal-orchestrator/src/tests/entitlementGateAdapter.test.ts` (10 cases, new).
- `apps/legal-orchestrator/src/config/featureFlags.ts` — `ITERLAW_ENTITLEMENT_GATE_ENABLED` added.
- `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` — Sprint 30 entitlement-gate block added ahead of Sprint 18A.
- `docs/iterlaw/architecture/ITERLAW_ENTITLEMENT_AND_SUBSCRIPTION_MODEL.md` — Sprint 30 addendum.
- `docs/iterlaw/project/12-entitlements/ENTITLEMENT_FOUNDATION.md` — Sprint 30 follow-up.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/entitlementGateAdapter.test.ts
 ✓ src/tests/entitlementGateAdapter.test.ts (10 tests) 14ms
TEST_EXIT=0
```

Behaviour verified:

- Flag default OFF; parses canonical truthy / falsy strings.
- No loader → `no_loader_configured`.
- Active UK Employment entitlement → allowed.
- Planned-module entitlement → `module_not_active`.
- No entitlement → `no_entitlement_for_module`.
- Expired → `entitlement_expired`.
- Inactive → refused.
- Allow path records `entitlement:ok`.
- Loader throw → swallowed; `loader_error` reported.

## Wiring contract

- Flag OFF → entitlement block not entered. `handleLegalRequest` identical to pre-Sprint-30 (modulo the still-shadow Sprint 18A block).
- Flag ON, no loader injected → gate records `no_loader_configured`; legacy answer path unchanged.
- Adapter throws → swallowed; legacy path unchanged.

## Production gate impact

None. Default-OFF flag.

## What this sprint does NOT do

- Does **not** integrate any payment provider.
- Does **not** read live billing state.
- Does **not** access customer or PII data.
- Does **not** add a DB migration.
- Does **not** block any answer in this sprint (shadow-mode trace only).
- Does **not** invoke any LLM.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
