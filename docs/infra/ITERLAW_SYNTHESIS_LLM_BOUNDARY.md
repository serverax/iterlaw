# IterLaw — Synthesis & LLM Boundary

## The invariant

`legal-orchestrator` never holds, references, or calls an LLM. Synthesis is
performed by `synthesis-worker`, which the orchestrator reaches over Redis
Streams only. Even then, the worker may run with no model at all.

## State table

| `MODEL_MODE`     | Effect                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| `disabled`       | Every synthesis request returns `synthesis_unavailable`. No model contact.  |
| `internal`       | The worker POSTs to `INTERNAL_MODEL_ENDPOINT` (in-cluster only).            |

`EXTERNAL_LLM_ENABLED` is `false` in both modes. Setting it to `true` is a
contract breach and CI rejects the change.

## Streams

| Stream                              | Direction                                |
| ----------------------------------- | ---------------------------------------- |
| `iterlaw:synthesis:requests`        | orchestrator → worker (XADD by orchestr.)|
| `iterlaw:synthesis:responses`       | worker → orchestrator (XADD by worker)   |

Stream names are configured via ConfigMap on both workloads and are
asserted by `verify-iterlaw-repo.sh`.

## Failure semantics

| Condition                          | Response                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| Redis unreachable                  | `legal-orchestrator` → 503 `synthesis_offline`.                    |
| Worker not consuming               | `legal-orchestrator` → 504 `synthesis_timeout`.                    |
| Worker in `MODEL_MODE=disabled`    | Worker replies `synthesis_unavailable` on the response stream.     |
| Internal model returns 5xx         | Worker replies `synthesis_internal_error`. No external fallback.   |

## What WASM does NOT do

The WASM rule runner is unrelated to this boundary. WASM modules perform
deterministic legal calculations; they are not asked to synthesise text.
See `ITERLAW_WASM_INFRA.md`.

## What CI checks

- No LLM client imports in `apps/legal-orchestrator/src/**`.
- No `OLLAMA_URL`, `CLAUDE_API_KEY`, `OPENAI_API_KEY` references inside
  `k8s/iterlaw/legal-orchestrator/`.
- `EXTERNAL_LLM_ENABLED` and `EXTERNAL_LLM_USED` set to `false` in the
  orchestrator ConfigMap.
- The audit ring in the WASM runner always records `external_llm_used=false`.
