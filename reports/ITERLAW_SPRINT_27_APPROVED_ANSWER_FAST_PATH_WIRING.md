# Sprint 27 — Wire approved-answer fast path into handleLegalRequest

## Verdict: PASS

Sprint 26 fast path wired behind `ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED` (default OFF). Shadow telemetry only — legacy answer path unchanged and citation gates remain authoritative. 9 vitest cases. No external LLM. No DB. No network.

## Files

- `apps/legal-orchestrator/src/retrieval/approvedAnswerFastPathGateway.ts` (new — pure adapter).
- `apps/legal-orchestrator/src/tests/approvedAnswerFastPathGateway.test.ts` (new — 9 cases).
- `apps/legal-orchestrator/src/retrieval/index.ts` — exports the gateway.
- `apps/legal-orchestrator/src/config/featureFlags.ts` — `ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED` added (default OFF).
- `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` — fast-path gateway block placed after the Sprint 19A multi-tier block; runs only when the flag is ON; shadow-only.
- `docs/iterlaw/project/09-retrieval/SPEED_FIRST_RETRIEVAL_PHASE_1.md` — Sprint 27 addendum.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/approvedAnswerFastPathGateway.test.ts
 ✓ src/tests/approvedAnswerFastPathGateway.test.ts (9 tests) 7ms
TEST_EXIT=0
```

Behaviour verified:

- Flag default OFF; parses canonical truthy / falsy strings.
- No-lookup → `no_lookup_configured` in trace.
- Valid approved entry → `hit: true` + `fast_path:hit`.
- Stale / failed-QA / uncited entries all → `hit: false`.
- Decision trace begins with `fast_path_gateway:entered`.
- Lookup exceptions swallowed; trace records `fast_path_gateway:*`.

## Wiring contract

- Flag OFF → fast-path block is **not entered**. `handleLegalRequest` behaves identically to pre-Sprint-27.
- Flag ON, no `lookup` dependency injected → gateway records `no_lookup_configured` and returns. Public response unchanged. Citation gates unaffected.
- Even on a hit (flag ON + injected lookup), the sprint does **not** bypass the legacy answer path. A future sprint can introduce a tightened early-return; out of scope here.

## Production gate impact

None. Default-OFF flag.

## What this sprint does NOT do

- Does **not** return early on a fast-path hit. The legacy answer path runs regardless.
- Does **not** wire any persistent cache. The lookup is dependency-injected.
- Does **not** weaken any existing citation gate.
- Does **not** call any LLM.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
