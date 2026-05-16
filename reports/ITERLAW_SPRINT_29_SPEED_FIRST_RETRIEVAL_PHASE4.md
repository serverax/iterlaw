# IterLaw Sprint 29 — Speed-First Retrieval Phase 4 (Speculative Decoding)

## Scope

- Migration `125_sprint29_retrieval_speculative_decode_cache.sql` — `retrieval_speculative_decode_cache` (admin RLS).
- `retrievalSpeculativePhase4.ts` — `RetrievalSpeculativePhase4Band` with Phase 2–3 integration.
- `zone2RetrievalStub.ts` — `speculativeDecodeDraft`, `verifyDraftAgainstVerifier`.
- Tests: `sprint29RetrievalSpeculativePhase4.test.ts` (49).
- Test helper: `src/tests/helpers/zone2RetrievalTestDouble.ts` (`delegatingZone2Retrieval`).

## Verification

- `npm run typecheck` / `npm test` in `apps/legal-orchestrator`.

**Commit (code):** 1f01aa348c0fd26024b5c0a4eb8707fa084378ce
