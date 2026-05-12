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
| `SYNTHESIS_REDIS_URL_FROM_SECRET` | SealedSecret ref      | Redis DSN (in-cluster).                                          |
| `SYNTHESIS_REQUEST_STREAM`        | ConfigMap             | `iterlaw:synthesis:requests`.                                    |
| `SYNTHESIS_RESPONSE_STREAM`       | ConfigMap             | `iterlaw:synthesis:responses`.                                   |
| `SYNTHESIS_TIMEOUT_MS`            | ConfigMap             | Per-request synthesis wait budget.                               |
| `EXTERNAL_LLM_ENABLED`            | ConfigMap             | **Must be `false`.**                                             |
| `EXTERNAL_LLM_USED`               | ConfigMap             | **Must be `false`.**                                             |
| `WASM_RULES_ENABLED`              | ConfigMap             | `true`.                                                          |
| `WASM_RULES_PATH`                 | ConfigMap             | `/app/wasm-rules` (read-only volume).                            |

`legal-orchestrator` MUST NOT carry `OLLAMA_URL`, `CLAUDE_API_KEY`,
`OPENAI_API_KEY`, or any other LLM provider credentials.

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
| `MODEL_MODE`                          | ConfigMap         | `disabled` (default) or `internal`.                  |
| `INTERNAL_MODEL_ENDPOINT_FROM_SECRET` | SealedSecret ref  | Only consumed when `MODEL_MODE=internal`.            |
| `INTERNAL_MODEL_NAME`                 | ConfigMap         | Free-form model identifier for audit logs.           |
| `EXTERNAL_LLM_ENABLED`                | ConfigMap         | **Must be `false`.** External LLMs are forbidden.    |

If `MODEL_MODE=disabled`, the synthesis-worker returns `synthesis_unavailable`
to every request and never attempts to call any model endpoint.

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
