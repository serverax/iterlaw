# IterLaw Citation Verification and Evidence Packs

Sprint 24 hardens the citation verifier and adds a structured evidence-pack output.

## Files

- `apps/legal-orchestrator/src/citations/evidencePack.types.ts` — pack + per-entry types.
- `apps/legal-orchestrator/src/citations/citationVerifier.ts` — hardened wrapper around the existing `modules/citationVerifier.ts`.
- `apps/legal-orchestrator/src/citations/evidencePackBuilder.ts` — builds an evidence pack from a verified citation list + the retrieval candidates that backed them.
- `apps/legal-orchestrator/src/citations/index.ts` — public re-export.
- `apps/legal-orchestrator/src/tests/evidencePackAndCitationVerifier.test.ts` — 13 vitest cases.

## Hard rules (verified by tests)

1. **No uncited legal claim.** An answer containing legal-claim heuristics (`ERA 1996`, `tribunal`, `section`, `discriminat...`, etc.) with zero declared citations → `blocked_no_citation`.
2. **No source = block.** A citation whose backing `RetrievalCandidate` has no `source_url` → `blocked_no_source`.
3. **Chunk not in retrieved set = block.** Inherited from the base verifier → `blocked_chunk_not_found`.
4. **Quote not in chunk text = block.** Inherited from the base verifier → `blocked_quote_not_supported`.
5. **Stale source = block unless historical mode.** `superseded_by` set OR `effective_to < today` → `blocked_stale` (or `needs_review` when `historicalMode === true`).
6. **Weak source = needs review.** Trust score in `(0, minTrust)` → `needs_review`; trust score == 0 → `blocked_low_trust`.
7. **No model confidence without source.** The verifier does not consume any "confidence" hint from an LLM — only deterministic source + retrieval signals.

## Evidence pack shape

Each entry carries exactly the fields the spec called for:

```ts
{
  source_id, source_title, source_url, source_type,
  effective_from, effective_to,
  trust_score, chunk_id,
  claim_supported, citation_status,
  warnings, reason_codes,
}
```

`citation_status` is one of:

- `fully_cited`
- `needs_review`
- `blocked_stale`
- `blocked_low_trust`
- `blocked_no_source`
- `blocked_no_citation`
- `blocked_quote_not_supported`
- `blocked_chunk_not_found`

`overallStatus` on the pack rolls up: any block status → that block status; otherwise any `needs_review` → `needs_review`; otherwise `fully_cited`.

## What this sprint does NOT do

- Does **not** call an external classifier / LLM.
- Does **not** wire itself into `handleLegalRequest`. That wiring (placing the hardened verifier and the evidence-pack builder ahead of the legacy citation gate) is a future, change-controlled sprint.
- Does **not** change the existing `modules/citationVerifier.ts` behaviour — Sprint 24 builds **on top** of it and preserves every existing failure code.
- Does **not** modify G15 in the production readiness gate JSON (the citation gate stays PASS; this sprint tightens the model used by future wiring sprints).

## Sprint 29 — wired into `handleLegalRequest` in shadow mode

Sprint 29 adds `runHardenedCitationGate(input)` (the orchestrator-shape adapter at `apps/legal-orchestrator/src/citations/citationGateAdapter.ts`) and invokes it right after the drafter produces an answer + citations in the Phase-4 synth path. The call is **shadow-mode**:

- The legacy citation verifier inside `runLocalDraftingStep` / `modules/citationVerifier.ts` stays authoritative.
- The hardened gate produces a structured evidence pack + decision trace, but the orchestrator does **not** change the LegalResponse based on its output in this sprint.
- Any exception thrown by the adapter is swallowed so the legacy gate is never weakened.

8 vitest cases at `apps/legal-orchestrator/src/tests/citationGateAdapter.test.ts` prove the gate enforces:

- Zero citations + legal-claim heuristics → `blocked_no_citation`.
- Citation backed by a chunk with no `url` → `blocked_no_source`.
- Stale source (effective_to in the past) → `blocked_stale` (or `needs_review` in historical mode).
- Trust score in `(0, minTrust)` → `needs_review`.
- camelCase citation shape (`chunkId` / `quoteText`) is accepted as an alias.
- Decision trace begins with `citation_gate:entered`.

## Sprint 34 — evidence-attached golden fixtures

`apps/legal-orchestrator/src/tests/fixtures/legalGoldenEvidenceFixtures.ts` adds 10 evidence-attached fixtures covering supported / missing / stale / weak evidence shapes. `apps/legal-orchestrator/src/tests/legalGoldenEvidenceHarness.test.ts` runs each through `buildEvidencePack` and confirms the overall pack status matches the fixture's declared `expected_outcome`. The fixtures act as a deterministic regression-tracking harness for citation-gate behaviour — any future change that mis-classifies missing / stale / weak evidence will fail the harness.
