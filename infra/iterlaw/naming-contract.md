# IterLaw — Naming Contract

This contract is **load-bearing**. CI and the infra verification scripts under
`scripts/infra/` reject changes that violate it.

## Canonical project facts

| Facet                | Value                                       |
| -------------------- | ------------------------------------------- |
| Product name              | IterLaw                                     |
| GitHub repo               | https://github.com/serverax/iterlaw.git     |
| Local checkout            | `C:\Users\kalsh\projects\iterlaw`           |
| Application namespace     | `iterlaw-ai`                                |
| Database namespace        | `iterlaw-data`                              |
| Backend workload          | `legal-orchestrator` (in `iterlaw-ai`)      |
| Backend port              | `3012`                                      |
| Public API endpoint       | `POST /api/legal/ask`                       |
| Web workload              | `iterlaw-web` (in `iterlaw-ai`)             |
| Synthesis workload        | `synthesis-worker` (in `iterlaw-ai`)        |
| Queue                     | Redis Streams                               |
| Redis workload            | `synthesis-redis` (in `iterlaw-ai`)         |
| Postgres workload         | `iterlaw-postgres` (in `iterlaw-data`)      |
| Postgres internal DNS     | `iterlaw-postgres.iterlaw-data.svc.cluster.local` |
| Postgres image            | `pgvector/pgvector:pg16` (StatefulSet)      |
| Database name             | `iterlaw`                                   |
| Runtime RAG schema        | `public` (the orchestrator queries `public.legal_chunks` etc.) |
| UK-employment domain schema | `uk_emp_rag` (statutory rates, Q&A cache, evidence, superseded_by) |
| Runtime chunks table      | `public.legal_chunks` (with `search_vector`, `applicable_to`, `embedding vector(1536)`) |
| Domain-slice chunks       | `uk_emp_rag.legal_document_chunks`          |
| Domain-slice embeddings   | `uk_emp_rag.legal_chunk_embeddings`         |
| Statutory rates           | `uk_emp_rag.statutory_rate`                 |
| Source registry           | `uk_emp_rag.legal_sources` (no separate `legal_source_registry` table) |
| Source-fetch audit        | `public.source_fetch_audit` (replaces earlier-drafted `source_freshness`) |
| Secrets backend           | SealedSecrets                               |

## Namespace split

| Namespace      | Owns                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| `iterlaw-ai`   | `iterlaw-web`, `legal-orchestrator`, `synthesis-worker`, `synthesis-redis`, WASM rule config |
| `iterlaw-data` | `iterlaw-postgres`, backup CronJob, database PVCs, database SealedSecret templates           |

PostgreSQL is **never** deployed in `iterlaw-ai`. The web tier and the
synthesis-worker never talk to PostgreSQL — only `legal-orchestrator`
connects, using `iterlaw-db-secret` in `iterlaw-ai`.

## Image tags

- `iterlaw/legal-orchestrator:local`
- `iterlaw/synthesis-worker:local`
- `iterlaw/web:local`

## Forbidden names

The following names MUST NOT appear in any IterLaw file (manifest, doc, script,
source, or test). They are reserved or come from retired ancestors of this
project.

- `rightsnow`
- `ordinox-ai` (only as an *IterLaw* namespace — the ordinox-ai namespace is a
  separate, retired environment)
- `iterlaw-ollama`
- `iterlaw-rag-api`
- `iterlaw-ingestion-worker`
- `iterlaw_knowledge`
- `iterlaw_user`
- `legal_questions`
- `/api/answer`
- `model_used: "ollama"` (when emitted from `legal-orchestrator`)
- `model_used: "claude"` (when emitted from `legal-orchestrator`)
- `OLLAMA_URL` in `legal-orchestrator`
- `CLAUDE_API_KEY` in `legal-orchestrator`
- `OPENAI_API_KEY` in `legal-orchestrator`

> `iterlaw-postgres` was previously on this list. It is now the canonical
> workload name for the PostgreSQL StatefulSet in the dedicated
> `iterlaw-data` namespace. It is permitted in active manifests under
> `k8s/iterlaw-data/`.

`scripts/infra/verify-iterlaw-repo.sh` enforces this list against the
`infra/iterlaw`, `k8s/iterlaw`, `docs/infra`, and `scripts/infra` trees.

## Allowed deviations

- Historical mentions of retired names (e.g. inside `db/` migrations that have
  already shipped, or inside the legacy `k8s/legal-orchestrator/` tree) are
  out of scope of this contract. The contract applies to *new* IterLaw infra
  surface only.
