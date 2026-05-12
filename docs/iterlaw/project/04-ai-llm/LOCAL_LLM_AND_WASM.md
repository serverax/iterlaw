# IterLaw — Local LLM + WASM Gates

Two distinct layers. The local LLM **drafts** text from retrieved chunks. WASM provides **deterministic** gates that the LLM cannot bypass. Full plan: `docs/iterlaw/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`.

## Local LLM — role

After retrieval succeeds and the citation gate has passed:

- Summarise retrieved chunks in plain English.
- Map retrieved law to the user's facts.
- Identify missing facts the user should provide next.
- Suggest plain-English next steps.
- Compose the structured envelope (answer + citations + next steps + deadline warnings).

The local LLM **never**:

- Invents statutes, regulations, cases, or guidance pages.
- Cites anything that did not arrive in the retrieval set.
- Decides the final answer alone — the citation + policy gates do.
- Touches user case data unnecessarily (only the minimum needed to draft).
- Receives secrets in the prompt.

## Gateway

Sprint 11 added `apps/legal-orchestrator/src/legal/llm/localLlmGateway.ts`. Default mode is `"disabled"`. Supported modes via env:

- `ITERLAW_LLM_GATEWAY_MODE=disabled` (default)
- `ITERLAW_LLM_GATEWAY_MODE=ollama` + `ITERLAW_OLLAMA_BASE_URL=…`
- `ITERLAW_LLM_GATEWAY_MODE=llama_cpp` + `ITERLAW_LLAMA_CPP_BASE_URL=…`
- `ITERLAW_LLM_GATEWAY_MODE=bifrost` + `ITERLAW_BIFROST_BASE_URL=…`

`ITERLAW_LOCAL_LLM_ENABLED=true` is required for any mode other than `disabled`. The gateway never calls a public-cloud provider.

## Local model examples (only those already in repo / memory)

The synthesis-worker `ConfigMap` (`k8s/iterlaw/synthesis-worker/configmap.yaml`) lists three Ollama-served local models by name:

- `uk-employment-qwen:latest`
- `uk-employment-drafting:latest`
- `uk-employment-document:latest`

These are **model identifiers** (Ollama-style `name:tag`), not container `image:` references. The synthesis worker reaches an internal cluster-DNS Ollama service whose URL is set in `k8s/iterlaw/synthesis-worker/configmap.yaml` (a legacy namespace name appears in the current manifest pending the namespace migration tracked separately; the IterLaw canonical namespaces are `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`).

The Sprint 11 `localTransportPolicy` enforces, at runtime, that the configured transport target is either `localhost` / `127.0.0.1`, a Kubernetes cluster-DNS host (`*.svc` / `*.svc.cluster.local`), or an explicitly allow-listed internal host. Public-provider hosts (`api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai`) are permanently denied.

No other model is approved at the time of writing. Adding a model is an AI-Architect AIA decision.

## Bounded synthesis guard

`apps/legal-orchestrator/src/legal/llm/boundedSynthesis.ts` enforces:

- Empty `retrievedChunks` → `insufficient_sources`.
- Any chunk missing `chunkId` / `documentId` / `title` / `url` / `citationLabel` / `text` → `citation_failed`.
- Gateway unavailable → `llm_unavailable` (citations still preserved for the caller).
- In Sprint 11's interface-only state → `blocked_by_policy` (no answer text).

The guard is the **only** place where bounded LLM output is allowed to be formed.

## WASM — deterministic fast gates

WASM is **not** the main inference engine. It is used for sub-millisecond gates that must be tamper-resistant:

| WASM gate | Purpose |
| --- | --- |
| Citation verifier | Confirms every cited URL matches a `legal_documents.url` or `legal_chunks.url`. |
| Policy gate | Off-topic / jurisdiction-mismatch / banned-claim checks. |
| PII redactor | Strips PII from outbound logs and prompts. |
| Deadline calculator | Computes statutory deadlines (limitation periods, ACAS clock). |
| Rule engine | Runs deterministic rules (unfair-dismissal qualifying period, fire-and-rehire conditions, zero-hours reference period). |
| Source trust scorer | Ranks evidence by source tier + effective date. |
| Routing logic | Picks classification / extraction sub-route. |

The WASM rule-runner contract lives at `infra/iterlaw/wasm-contract.md`. The runtime lives in `packages/legal-core/`.

## WASM is not used for

- Free-text legal-answer drafting (the local LLM does that, behind the citation gate).
- Autonomous legal decisions (a qualified human approves anything high-risk).
- Self-training / weight updates (research-only; never on production paths).
- Network calls.

## Forbidden in the request path

- External LLM provider call (OpenAI / Anthropic / Gemini / etc.).
- HTTP `fetch` / `axios` / `node-fetch` in the orchestrator source.
- LLM output emitted without citation gate.
- Performance claim ("sub-second", "under 10ms") without a measured benchmark in `docs/benchmarks/`.

## Slow path / background worker model (target)

The local LLM should become the **slow path / background worker** wherever a deterministic alternative exists.

- **Cache / section / knowledge graph answer repeated or deterministic questions.** The local LLM does not run for these.
- **Local LLM still runs** for novel-question synthesis, background pre-building, cache enrichment, document drafting, and difficult / edge-case explanation.
- **Streaming UX is planned** (see [`SPEED_AND_STREAMING_ARCHITECTURE.md`](SPEED_AND_STREAMING_ARCHITECTURE.md)) — SSE endpoint, structured three-part reveal (WHAT THE LAW SAYS / WHAT THIS MEANS / WHAT TO DO NOW), adviser openers, and graceful mid-stream failure handling.
- **Two-stage local model cascade is planned** — small fast model first, strong model on low-confidence fallback. The router (`modelRouter`) decides; the citation gate is identical for both stages.
- **External AI is NOT the default path.** No provider SDK exists in `apps/legal-orchestrator/package.json`. The Sprint 11 Phase 2A transport policy denies provider hosts at runtime.

## Sprint 11 status (today)

- Sprint 11 Phase 1 (foundation): **PASS**. Router + citation-bound prompt builder + output guard + disabled-by-default drafting helper.
- Sprint 11 Phase 2A (audit + transport guardrails): **PASS**. Audit types + redactor + Noop / InMemory sinks + transport policy.
- Live HTTP transport: **NOT STARTED**.
- Pipeline wiring (`handleLegalRequest` calls `runLocalDraftingStep`): **NOT STARTED**.
- Gateway: **DISABLED / MOCK-SAFE**.
- Production: **BLOCKED** until Sprint 10 real staging DB verification passes.
