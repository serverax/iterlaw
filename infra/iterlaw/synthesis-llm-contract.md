# IterLaw — Synthesis & LLM Boundary

## Architecture invariant

```
iterlaw-web (Next.js)
        |
        |  HTTPS via Ingress
        v
legal-orchestrator (Express, port 3012)
        |
        |  Redis Streams: iterlaw:synthesis:requests
        v
synthesis-redis (StatefulSet, ClusterIP)
        ^
        |  Redis Streams: iterlaw:synthesis:responses
        |
synthesis-worker  ----+
                      |  optional internal model call (HTTP)
                      v
            INTERNAL_MODEL_ENDPOINT (cluster-local only)
```

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
   `INTERNAL_MODEL_ENDPOINT` over cluster-local HTTP only. The endpoint
   value is supplied via the `iterlaw-synthesis-internal-model` SealedSecret.
7. No external (public-internet) LLM endpoint is permitted, in either mode.
   `EXTERNAL_LLM_ENABLED=false` on `synthesis-worker` is enforced.
8. WASM is **not** an LLM substitute. WASM modules are deterministic rule
   functions, not text generators. See `wasm-contract.md`.

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
