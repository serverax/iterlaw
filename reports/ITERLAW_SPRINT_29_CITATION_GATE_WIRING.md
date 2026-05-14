# Sprint 29 — Wire hardened citation verifier + evidence-pack builder

## Verdict: PASS

Sprint 24 hardened verifier + evidence-pack builder now wired into `handleLegalRequest` in **shadow mode**. Legacy citation gate stays authoritative; the hardened gate is additive and produces a structured decision trace + evidence pack. 8 vitest cases. No external LLM. No DB. No network.

## Files

- `apps/legal-orchestrator/src/citations/citationGateAdapter.ts` — new orchestrator-shape adapter `runHardenedCitationGate(input)`.
- `apps/legal-orchestrator/src/citations/index.ts` — re-export.
- `apps/legal-orchestrator/src/tests/citationGateAdapter.test.ts` — 8 vitest cases.
- `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` — Sprint 29 shadow-call placed after `runLocalDraftingStep` and before `mapDrafterOutputToLegalResponse`.
- `docs/iterlaw/architecture/ITERLAW_CITATION_VERIFICATION_AND_EVIDENCE_PACKS.md` — Sprint 29 addendum.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/citationGateAdapter.test.ts
 ✓ src/tests/citationGateAdapter.test.ts (8 tests) 13ms
TEST_EXIT=0
```

Behaviour verified:

- Legal-claim answer with zero citations → `blocked_no_citation`.
- Fully-cited approved + strong-trust statutory source → `fully_cited`.
- Stale source (effective_to past, no historicalMode) → `blocked_stale`.
- Stale source under `historicalMode: true` → `needs_review`.
- Trust in `(0, minTrust)` → `needs_review`.
- Citation backed by a chunk with no `url` → `blocked_no_source`.
- camelCase citation shape accepted (`chunkId` / `quoteText`).
- Decision trace begins with `citation_gate:entered` and includes `citation_gate:status:<overall>`.

## Wiring contract

- Shadow mode: orchestrator does **not** alter the LegalResponse on the hardened gate's output in this sprint. The legacy verifier inside the drafter retains authority.
- The hardened gate runs only when the Phase-4 transport path is active (drafter produces citations); off the synth path it is not called.
- Any exception thrown by the adapter is swallowed defensively so the legacy gate is never weakened.

## Production gate impact

None. G15 stays PASS. Sprint 29 strengthens the model used by future wiring sprints without changing today's answer-path behaviour.

## What this sprint does NOT do

- Does **not** replace the legacy verifier in `modules/citationVerifier.ts`.
- Does **not** change the LegalResponse shape.
- Does **not** invoke any LLM.
- Does **not** open any network socket.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
