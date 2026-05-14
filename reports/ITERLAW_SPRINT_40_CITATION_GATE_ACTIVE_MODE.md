# Sprint 40 — Citation gate active mode behind flag

## Verdict: PASS

`runCitationGateActive` wraps the Sprint 24/29 hardened gate with a structured `allowed | downgraded | blocked | shadow_only` decision shape. Default OFF (`shadow_only`). When ON, uncited / stale / weak / no-source citations are blocked or downgraded with explicit user-message payloads. Legacy answer path preserved when flag is OFF. Entitlement gate not bypassed. 13 vitest cases.

## Files

- `apps/legal-orchestrator/src/config/featureFlags.ts` — `ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED` flag added (default OFF).
- `apps/legal-orchestrator/src/citations/citationGateActiveMode.ts` (new — pure wrapper around `runHardenedCitationGate`).
- `apps/legal-orchestrator/src/citations/index.ts` — re-export.
- `apps/legal-orchestrator/src/tests/citationGateActiveMode.test.ts` (13 cases, new).

## Decision shape

```ts
type CitationGateActiveDecision = {
  type: "shadow_only" | "allowed" | "downgraded" | "blocked";
  mode: "shadow" | "active";
  pack: EvidencePack;
  blockedResponse?: {
    status: "blocked";
    reason: CitationStatus;
    userMessage: string;
    reasonCodes: ReadonlyArray<string>;
  };
  decisionTrace: ReadonlyArray<string>;
  telemetry: { allowed: number; blocked: number; downgraded: number; shadowOnly: number };
};
```

`blockedResponse` is set only when `type === "blocked"`. The `userMessage` is a deterministic phrase per blocked reason — never an LLM call. The orchestrator caller is responsible for honouring the decision (e.g. returning the blocked response or downgrading the answer's confidence).

## Behaviour matrix (verified)

| Flag | Citations | Expected `type` | Notes |
|---|---|---|---|
| OFF | any | `shadow_only` | Legacy path preserved. |
| ON | cited + approved + fresh + strong-trust | `allowed` | |
| ON | zero citations + legal-claim heuristics | `blocked` | `reason: blocked_no_citation` |
| ON | citation w/ no `url` | `blocked` | `reason: blocked_no_source` |
| ON | stale source (not historical) | `blocked` | `reason: blocked_stale` |
| ON | stale source + historicalMode | `downgraded` | |
| ON | trust score in `(0, minTrust)` | `downgraded` | |
| ON | trust score `0` | `blocked` | `reason: blocked_low_trust` |
| ON | quote not in chunk | `blocked` | `reason: blocked_quote_not_supported` |

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/citationGateActiveMode.test.ts
 ✓ src/tests/citationGateActiveMode.test.ts (13 tests) 11ms
TEST_EXIT=0
```

Test coverage includes flag default OFF, canonical truthy/falsy parsing, every block reason, every downgrade reason, trace + telemetry shape, and a regression assertion that the active-mode module does not import from entitlements (entitlement gate not bypassed).

## Wiring contract

Sprint 40 **does NOT alter the answer-path response shape in `handleLegalRequest`**. The legacy verifier inside `runLocalDraftingStep` + `modules/citationVerifier.ts` remains authoritative. Operators wire `runCitationGateActive` into the answer-path by replacing the shadow-mode invocation (Sprint 29) with this function, gating their response logic on the returned `type`. That orchestrator wiring is a future sprint under change control.

## Production gate impact

None. Default-OFF flag. G15 (citation gates active) stays PASS — Sprint 40 tightens the model without changing today's answer-path behaviour.

## What this sprint does NOT do

- Does **not** replace `handleLegalRequest`'s citation-gate logic. The active-mode wiring at the answer-path is a separate future sprint.
- Does **not** weaken any existing citation rule. Every Sprint 24/29 refusal still applies.
- Does **not** bypass the entitlement gate (Sprint 30).
- Does **not** invoke any LLM. The user message is a deterministic phrase per reason.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
