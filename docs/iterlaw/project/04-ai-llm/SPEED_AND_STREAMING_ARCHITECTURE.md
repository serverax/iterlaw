# Speed and Streaming Architecture

How IterLaw delivers a fast, ChatGPT-like answer experience without bypassing legal safety. **Roadmap doc — not implementation.** Every component below is feature-flagged and gated behind the citation gate.

**Status:** target architecture. None of this is wired today. See `ROADMAP_REMAINING_SPRINTS.md` (Sprints 26–34, 43).

## Headline rules

- The legal citation gate **must still pass** for every served answer.
- Cache streaming **must not bypass** legal safety: stream only bytes of an answer that already passed all gates.
- Every component is **feature-flagged**.
- Every speed claim ("sub-second", "X ms p95") must come from a measured benchmark recorded in `docs/benchmarks/`.
- Production: **BLOCKED** until staging DB verification passes. Speed work cannot ship into prod until that gate clears.

## Components

### 1. HNSW semantic cache

- Postgres + pgvector HNSW index on `module_qa_cache.question_embedding`.
- Replaces full-scan vector similarity on cache reads.
- Target: cache-hit decision in <50 ms p95 at module scale.
- Sprint 19 / 26.

### 2. Ollama `keep_alive`

- Configure the Ollama service with `keep_alive` so the model weights stay resident between requests.
- Removes cold-start latency on the local LLM tier (Tier 4).
- Operator setting; not a code change in this repo.
- Sprint 27.

### 3. Ollama flash attention (requested)

- Request flash-attention support in the operator-deployed Ollama config when the underlying model supports it.
- Reduces prefill latency on long context.
- **Not yet confirmed** for the chosen `uk-employment-*` models — Sprint 27 benchmark must record the actual support level before claims are made.

### 4. Prefix / prompt reuse

- Where the Ollama runtime supports KV-cache reuse, share the static prefix (system prompt + style guide + retrieved chunks header) across requests.
- Avoids re-prefilling the same tokens for every question.
- Sprint 27.

### 5. Structured JSON output

- The local model is asked to produce structured JSON (`{answer, citedChunkIds, missingFacts, deadlineWarnings}`).
- Parsing is deterministic; failures route to the output guard's `malformed_output` path.
- Reduces post-processing latency and improves UI rendering.
- Sprint 28.

### 6. Structured fill-in-the-blank answering

- The orchestrator hands the LLM a structured template (`{whatTheLawSays:'', whatThisMeans:'', whatToDoNow:''}`) and asks the model to fill the blanks **only**.
- Cuts free-form length, improves consistency, and lets the UI start rendering field-by-field as the model emits.
- Sprint 28.

### 7. Retrieval-augmented verification (RAV)

- For each generated answer, re-run retrieval on the answer's stated key terms and confirm the cited chunks are still present and authoritative.
- Failures route to `citation_failed`.
- Used both at synthesis time **and** as a background scan over cached answers (see retrieval Tier "Background").
- Sprint 29.

### 8. Speculative prefill UI

- The UI starts rendering the "what the law says" header and citation chips **before** the LLM finishes, based on the Tier 2/3 evidence pack.
- The body fills in as Tier 4 streams.
- A failed citation gate causes the UI to **revert** the optimistic header to a refusal status — the UX must handle this cleanly.
- Sprint 30.

### 9. Two-stage local model cascade

- **Stage 1 — small fast model** answers most questions where evidence is high-quality.
- **Stage 2 — strong model** runs only when Stage 1 produces low-confidence output or refuses.
- The router (`modelRouter`) decides the stage; the citation gate is identical for both.
- Sprint 31.

### 10. Deterministic legal knowledge graph

- A graph of stable facts (qualifying periods, statutory caps, ACAS clock, common limitation periods) keyed by `(country, module, fact_code)`.
- Deterministic answers come from the graph, not the LLM.
- Backs the Tier 2 section lookup with fact-level precision.
- Sprint 32.

### 11. SSE streaming endpoint

- Server-Sent Events endpoint that streams the structured JSON fields one at a time.
- Each event carries a `field` + `delta` + `citationIds` payload.
- Cancellation is supported (`AbortController` client-side, deadline server-side).
- Sprint 33.

### 12. Simulated streaming for cache hits

- A cache hit already has the full answer; the UI receives it as a single payload **then** locally simulates the streaming reveal so the experience matches an LLM stream.
- The simulation happens **client-side**; the server never withholds bytes that already passed safety.
- Sprint 33.

### 13. Adviser openers

- Short curated opener strings (e.g. "Looking at your dismissal date and the ERA 1996 framework, ...") emitted at the start of the stream while Tier 4 prefill runs.
- Openers are sourced from a fixed list per module + question type; never invented by the LLM.
- Sprint 33.

### 14. Structured three-part reveal

The answer UI shows three named sections:

- **WHAT THE LAW SAYS** — the cited statute / section / case text.
- **WHAT THIS MEANS** — plain-English application to the user's facts.
- **WHAT TO DO NOW** — concrete next steps + deadlines.

Each section streams in order. A user can see the law text in <300 ms p95 of submission (target — to be benchmarked), even if the synthesis still has to complete.

Sprint 33.

### 15. Graceful mid-stream failure handling

- If the citation gate or RAV trips mid-stream, the server emits a `safety_block` SSE event and the UI replaces the partial answer with the refusal state.
- The user is told **why** in plain English (insufficient_sources / citation_failed / policy_failed).
- No half-answers are left on screen.
- Sprint 34.

## Order of arrival

| Order | Component | Sprint |
| --- | --- | --- |
| 1 | HNSW semantic cache | 26 |
| 2 | Ollama keep_alive + prefix reuse | 27 |
| 3 | Structured JSON output / fill-in-the-blank | 28 |
| 4 | Retrieval-augmented verification | 29 |
| 5 | Speculative prefill UI | 30 |
| 6 | Two-stage model cascade | 31 |
| 7 | Knowledge graph | 32 |
| 8 | SSE streaming + adviser openers + 3-part reveal | 33 |
| 9 | Mid-stream failure handling | 34 |

## Hard rules (do not break)

- No live LLM call without the local-gateway transport policy allowing the target host.
- No streaming start until the citation gate has produced citation-complete chunks.
- No cache serve without re-verification of citations against the current corpus.
- No external provider in the live answer path. Sprint 11 transport policy denies provider hosts.
- No speed claim without a recorded benchmark in `docs/benchmarks/`.
- Each component lands behind its own feature flag, default off.

## Risks

- **Feature creep** — speed work pulled forward before first beta is shipped. Mitigation: roadmap fence (Sprints 26–34 are *post-first-beta*).
- **Streaming masks failure** — a partial stream looks like an answer. Mitigation: explicit `safety_block` event + UI handling.
- **HNSW staleness** — index drifts behind the cache table. Mitigation: rebuild job + monitoring on index recall.
- **Cost-of-context bloat** — prefix reuse breaks if the prompt template changes. Mitigation: prompt versioning + cache-invalidation key.

## Status

Nothing in this doc is implemented. The Sprint 11 foundation (router, citation-bound prompt builder, output guard, audit + transport policy) is a prerequisite. Live HTTP transport is **NOT STARTED**.
