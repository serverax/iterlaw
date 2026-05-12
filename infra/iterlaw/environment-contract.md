# IterLaw — Environment Contract

Environment variables for IterLaw workloads. **No other variables are
permitted** in the listed workloads' deployment manifests or ConfigMaps.

## `legal-orchestrator` (port 3012, ClusterIP only)

| Variable                          | Source                | Notes                                                            |
| --------------------------------- | --------------------- | ---------------------------------------------------------------- |
| `NODE_ENV`                        | ConfigMap             | `production` in cluster.                                         |
| `PORT`                            | ConfigMap             | Must be `3012`.                                                  |
| `LOG_LEVEL`                       | ConfigMap             | `info` default.                                                  |
| `DATABASE_URL_FROM_SECRET`        | SealedSecret ref      | Postgres DSN sourced from `iterlaw-db-secret`. Target is `iterlaw-postgres.iterlaw-data.svc.cluster.local:5432`. Never plaintext. |
| `RAG_MODE`                        | ConfigMap             | Must be `postgres`.                                              |
| `SYNTHESIS_MODE`                  | ConfigMap             | Must be `redis_streams`.                                         |
| `SYNTHESIS_REDIS_URL`             | ConfigMap             | `redis://synthesis-redis:6379` (in-cluster, no auth).            |
| `SYNTHESIS_REQUEST_STREAM`        | ConfigMap             | `iterlaw:synthesis:requests`.                                    |
| `SYNTHESIS_RESPONSE_STREAM`       | ConfigMap             | `iterlaw:synthesis:responses`.                                   |
| `SYNTHESIS_TIMEOUT_MS`            | ConfigMap             | Per-request synthesis wait budget.                               |
| `EXTERNAL_LLM_ENABLED`            | ConfigMap             | **Must be `false`.**                                             |
| `EXTERNAL_LLM_USED`               | ConfigMap             | **Must be `false`.**                                             |
| `WASM_RULES_ENABLED`              | ConfigMap             | `true`.                                                          |
| `WASM_RULES_PATH`                 | ConfigMap             | `/app/wasm-rules` (read-only volume).                            |
| `WASM_RULE_TIMEOUT_MS`            | ConfigMap             | Per-rule wall-clock budget. `50` ms is the policy default.       |
| `WASM_RULE_MAX_INPUT_BYTES`       | ConfigMap             | Maximum serialised input size accepted by the runner. `32768`.   |
| `WASM_RULE_FALLBACK_ENABLED`      | ConfigMap             | `true`. Permits the TypeScript fallback when the .wasm is absent.|

`legal-orchestrator` MUST NOT carry `OLLAMA_URL`, `INTERNAL_MODEL_ENDPOINT`,
`CLAUDE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MODEL_USED`, or
any other LLM provider credential / model identifier. The verifier rejects
manifests that introduce any of these.

## `synthesis-worker` (internal only)

| Variable                              | Source            | Notes                                                |
| ------------------------------------- | ----------------- | ---------------------------------------------------- |
| `NODE_ENV`                            | ConfigMap         |                                                      |
| `LOG_LEVEL`                           | ConfigMap         |                                                      |
| `SYNTHESIS_REDIS_URL_FROM_SECRET`     | SealedSecret ref  | Same Redis as orchestrator.                          |
| `SYNTHESIS_REQUEST_STREAM`            | ConfigMap         | `iterlaw:synthesis:requests`.                        |
| `SYNTHESIS_RESPONSE_STREAM`           | ConfigMap         | `iterlaw:synthesis:responses`.                       |
| `SYNTHESIS_WORKER_GROUP`              | ConfigMap         | `iterlaw-synthesis-workers`.                         |
| `SYNTHESIS_WORKER_NAME`               | Downward API      | Pod name.                                            |
| `MODEL_MODE`                          | ConfigMap         | `disabled` or `internal`. Short-term default is `internal`. |
| `INTERNAL_MODEL_ENDPOINT`             | ConfigMap         | `http://ollama.ordinox-ai.svc.cluster.local:11434` (temporary). |
| `INTERNAL_MODEL_ENDPOINT_FROM_SECRET` | SealedSecret ref  | Optional override. Takes precedence over the ConfigMap value when both are set. |
| `INTERNAL_MODEL_NAME`                 | ConfigMap         | Free-form model identifier for audit logs (mirrors `INTERNAL_MODEL_DEFAULT`). |
| `INTERNAL_MODEL_DEFAULT`              | ConfigMap         | `uk-employment-qwen:latest` — default legal answer synthesis. |
| `INTERNAL_MODEL_DRAFTING`             | ConfigMap         | `uk-employment-drafting:latest` — letters / documents.        |
| `INTERNAL_MODEL_DOCUMENT`             | ConfigMap         | `uk-employment-document:latest` — extraction / review.        |
| `EXTERNAL_LLM_ENABLED`                | ConfigMap         | **Must be `false`.** External LLMs are forbidden.    |

If `MODEL_MODE=disabled`, the synthesis-worker returns `synthesis_unavailable`
to every request and never attempts to call any model endpoint. The
`INTERNAL_MODEL_*` keys are only read when `MODEL_MODE=internal`.

## `iterlaw-web` (exposed via Ingress)

| Variable                       | Source     | Notes                                            |
| ------------------------------ | ---------- | ------------------------------------------------ |
| `NODE_ENV`                     | ConfigMap  |                                                  |
| `NEXT_PUBLIC_APP_NAME`         | ConfigMap  | `IterLaw`.                                       |
| `ORCHESTRATOR_INTERNAL_URL`    | ConfigMap  | `http://legal-orchestrator:3012`.                |
| `NEXT_PUBLIC_API_BASE`         | ConfigMap  | `/api`.                                          |

`iterlaw-web` MUST NOT carry any database environment variable. The web
tier never connects to Postgres directly.

## `synthesis-worker` — database boundary

`synthesis-worker` MUST NOT carry any database environment variable.
Database access is the sole responsibility of `legal-orchestrator`.

## Rules

1. Secrets are referenced by SealedSecret name + key. Never embed plaintext.
2. New variables require an update to this file **and** the relevant
   ConfigMap manifest in the same commit.
3. `scripts/infra/verify-iterlaw-repo.sh` rejects manifests that introduce
   variables not listed here.
