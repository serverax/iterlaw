# IterLaw Reranker Policy (deterministic, foundation)

> **No external reranker model. No external LLM. No network. No fake relevance claim.**

Implementation: `apps/legal-orchestrator/src/retrieval/reranker.ts`. Tests: `apps/legal-orchestrator/src/tests/rerankerPolicy.test.ts` (13 vitest cases).

## Purpose

The Sprint 19 multi-tier retrieval planner produced a `final_candidates` list using RRF fusion, metadata filtering, trust filtering, and freshness filtering. Sprint 23 adds a deterministic reranker that reorders that list using signals already present on each candidate — without any LLM call, embedding model, or external service.

## Score components

| Component | Sign | Default weight | Source signal |
|---|---|---|---|
| Trust | + | 1.0 | `qa_status` (approved → 1.0; draft / unreviewed → 0.5; failed → 0.0) |
| Freshness | + | 1.0 | `effective_to` not in the past AND `superseded_by` null |
| Exact-match boost | + | 1.0 | Candidate id present in the caller-supplied `exactMatchCandidateIds` set |
| Source tier | + | 1.0 | `source_type` mapped to a tier rank (statutory_source = 1.0, tribunal_case = 0.85, govuk/acas = 0.7, etc.) |
| Jurisdiction match | + | 1.0 | `source_url` carries the jurisdiction hint |
| Law-area match | + | 1.0 | `source_title` carries the law-area hint |
| Citation metadata completeness | + | 1.0 | Fraction of (source_url / source_title / effective_from / last_verified_at) populated |
| Stale penalty | − | 1.0 | `superseded_by` set OR `effective_to` in the past |
| Low-trust penalty | − | 1.0 | `qa_status === "failed"` or `"draft" / "unreviewed"` (trust < 0.5) |

Score = Σ(weighted positives) − Σ(weighted penalties). Stable sort descending; ties preserve the input order.

## Feature flag (default OFF)

`ITERLAW_RERANKER_ENABLED` boolean string. Default false. Multi-tier retrieval ignores the reranker unless this flag is explicitly true. Same parse-fail-closed contract as the existing intelligence-layer / law-module / multi-tier flags.

## Decision trace

Every score carries a `reasonCodes` array with a stable prefix `reranker:*`:

- `reranker:failed_qa_zero_trust`
- `reranker:stale`
- `reranker:exact_match`
- `reranker:jurisdiction_match`
- `reranker:law_area_match`
- `reranker:weak_citation_metadata`
- `reranker:low_trust`

The caller is responsible for including these in the audit envelope when telemetry-on.

## Out of scope (deliberately)

- No external reranker model (Cohere, Voyage, etc.).
- No embedding-based similarity reranking.
- No LLM-as-rerank judge.
- No production relevance claim — this is a deterministic foundation that future sprints can benchmark against a human-graded golden set.
