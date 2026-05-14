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
