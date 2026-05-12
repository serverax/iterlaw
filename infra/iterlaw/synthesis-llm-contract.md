# IterLaw — Synthesis & LLM Boundary

## Architecture invariant

```
iterlaw-web (Next.js, iterlaw-ai)
        |
        |  HTTPS via Ingress
        v
legal-orchestrator (Express, port 3012, iterlaw-ai)
        |
        |  Redis Streams: iterlaw:synthesis:requests
        v
synthesis-redis (StatefulSet, ClusterIP, iterlaw-ai)
        ^
        |  Redis Streams: iterlaw:synthesis:responses
        |
synthesis-worker (iterlaw-ai)
        |
        |  HTTP POST (in-cluster only)
        v
ollama.ordinox-ai.svc.cluster.local:11434   (temporary)
   uk-employment-qwen:latest      — default legal-answer synthesis
   uk-employment-drafting:latest  — letters and documents
   uk-employment-document:latest  — extraction and review
```

The Ollama service in `ordinox-ai` is a pre-existing internal model
service. IterLaw uses it as a short-term synthesis backend, **only**
from `synthesis-worker`. Long-term, this endpoint will move to a
dedicated `iterlaw-llm` namespace owned by IterLaw; that migration is
out of scope here.

## Rules

1. `legal-orchestrator` MUST NOT call Claude, OpenAI, Ollama, or any LLM
   provider directly. It has no client library for any of them.
2. `legal-orchestrator` MUST emit `external_llm_used=false` in every
   response audit. The variable is set by configuration and is also a
   compile-time invariant — there is no code path that flips it.
3. Synthesis flows only via:
   `legal-orchestrator` → Redis Streams → `synthesis-worker` →
   (internal model OR `synthesis_unavailable`) → Redis Streams →
   `legal-orchestrator`.
4. `synthesis-worker` is the **only** workload allowed to hold model
   configuration. It runs in `MODEL_MODE=disabled` or `MODEL_MODE=internal`.
5. When `MODEL_MODE=disabled`, `synthesis-worker` returns
   `synthesis_unavailable` on every request and never opens a model
   connection.
6. When `MODEL_MODE=internal`, `synthesis-worker` calls
   `INTERNAL_MODEL_ENDPOINT` (a cluster-local Ollama service) over
   in-cluster HTTP only. Short-term value:
   `http://ollama.ordinox-ai.svc.cluster.local:11434`. Routing by task:
   - `INTERNAL_MODEL_DEFAULT=uk-employment-qwen:latest` — answer synthesis.
   - `INTERNAL_MODEL_DRAFTING=uk-employment-drafting:latest` — drafting.
   - `INTERNAL_MODEL_DOCUMENT=uk-employment-document:latest` — extraction.
7. No external (public-internet) LLM endpoint is permitted, in either mode.
   `EXTERNAL_LLM_ENABLED=false` on `synthesis-worker` is enforced.
8. WASM is **not** an LLM substitute. WASM modules are deterministic rule
   functions, not text generators. WASM modules MUST NOT call Ollama or
   any model endpoint. See `wasm-contract.md`.

## Boundary tests

The following invariants are checked in CI:

- `grep` proves the `apps/legal-orchestrator` source contains no LLM client
  imports (`openai`, `anthropic`, `ollama`, `@anthropic-ai/sdk`, etc.).
- `grep` proves no environment variable named `OLLAMA_URL`,
  `CLAUDE_API_KEY`, or `OPENAI_API_KEY` is referenced from
  `legal-orchestrator`'s deployment manifest, ConfigMap, or source.
- The synthesis request stream name is `iterlaw:synthesis:requests` exactly.
- The synthesis response stream name is `iterlaw:synthesis:responses` exactly.

## Failure modes

| Condition                                | Behaviour                                                  |
| ---------------------------------------- | ---------------------------------------------------------- |
| Redis unavailable                        | `legal-orchestrator` returns 503 with code `synthesis_offline`. |
| `synthesis-worker` timeout               | `legal-orchestrator` returns 504 with code `synthesis_timeout`. |
| `MODEL_MODE=disabled` and synthesis req. | Worker returns `synthesis_unavailable` to the response stream.  |
| Internal model returns 5xx               | Worker returns `synthesis_internal_error`; no retry of external models. |
| Ollama service in `ordinox-ai` removed   | Operator updates the `synthesis-worker` ConfigMap to a new cluster-local endpoint, then restarts the worker. `legal-orchestrator` is unaffected. |
