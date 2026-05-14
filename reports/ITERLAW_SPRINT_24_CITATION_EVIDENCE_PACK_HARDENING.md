# Sprint 24 — Citation verification hardening + evidence-pack builder

## Verdict: PASS

Hardened citation verifier and evidence-pack builder added. Builds on top of the existing `apps/legal-orchestrator/src/modules/citationVerifier.ts` without modifying it. 13 vitest cases. No external LLM. No DB. No network.

## Files

- `apps/legal-orchestrator/src/citations/evidencePack.types.ts` (new).
- `apps/legal-orchestrator/src/citations/citationVerifier.ts` (new — hardened wrapper).
- `apps/legal-orchestrator/src/citations/evidencePackBuilder.ts` (new).
- `apps/legal-orchestrator/src/citations/index.ts` (new — public re-export).
- `apps/legal-orchestrator/src/tests/evidencePackAndCitationVerifier.test.ts` (new — 13 cases).
- `docs/iterlaw/architecture/ITERLAW_CITATION_VERIFICATION_AND_EVIDENCE_PACKS.md` (new).

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/evidencePackAndCitationVerifier.test.ts
 ✓ src/tests/evidencePackAndCitationVerifier.test.ts (13 tests) 12ms
TEST_EXIT=0
```

Suite grew to 84 files / 1051 tests after this sprint (verified with full orchestrator run later in this bundle).

## Behaviour matrix (verified)

| Case | Status |
|---|---|
| Legal-claim answer + zero citations | `blocked_no_citation` |
| Chunk not in retrieved set | `blocked_chunk_not_found` |
| Quoted text not in chunk text | `blocked_quote_not_supported` |
| Candidate has no source_url | `blocked_no_source` |
| Stale candidate, historicalMode=false | `blocked_stale` |
| Stale candidate, historicalMode=true | `needs_review` |
| Trust score in (0, minTrust) | `needs_review` |
| Trust score == 0 | `blocked_low_trust` |
| Approved candidate + strong trust + supporting source | `fully_cited` |

## Evidence pack fields (verified)

`source_id`, `source_title`, `source_url`, `source_type`, `effective_from`, `effective_to`, `trust_score`, `chunk_id`, `claim_supported`, `citation_status`, `warnings`, `reason_codes` — all present on every entry.

## Production gate impact

None directly. G15 (citation gates active) stays PASS — Sprint 24 tightens the citation model for future wiring sprints without modifying the existing answer-path verifier.

## What this sprint does NOT do

- Does **not** call any external LLM.
- Does **not** modify the existing `modules/citationVerifier.ts`.
- Does **not** wire itself into `handleLegalRequest`.
- Does **not** flip any production gate.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
