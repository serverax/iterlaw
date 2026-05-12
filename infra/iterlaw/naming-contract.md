# IterLaw — Naming Contract

This contract is **load-bearing**. CI and the infra verification scripts under
`scripts/infra/` reject changes that violate it.

## Canonical project facts

| Facet                | Value                                       |
| -------------------- | ------------------------------------------- |
| Product name         | IterLaw                                     |
| GitHub repo          | https://github.com/serverax/iterlaw.git     |
| Local checkout       | `C:\Users\kalsh\projects\iterlaw`           |
| K3s namespace        | `iterlaw-ai`                                |
| Backend workload     | `legal-orchestrator`                        |
| Backend port         | `3012`                                      |
| Public API endpoint  | `POST /api/legal/ask`                       |
| Web workload         | `iterlaw-web`                               |
| Synthesis workload   | `synthesis-worker`                          |
| Queue                | Redis Streams                               |
| Redis workload       | `synthesis-redis`                           |
| Database schema      | `uk_emp_rag`                                |
| Documents table      | `uk_emp_rag.legal_documents`                |
| Chunks table         | `uk_emp_rag.legal_document_chunks`          |
| Embeddings table     | `uk_emp_rag.legal_chunk_embeddings`         |
| Statutory rates      | `uk_emp_rag.statutory_rate`                 |
| Secrets backend      | SealedSecrets                               |

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
- `iterlaw-postgres`
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

`scripts/infra/verify-iterlaw-repo.sh` enforces this list against the
`infra/iterlaw`, `k8s/iterlaw`, `docs/infra`, and `scripts/infra` trees.

## Allowed deviations

- Historical mentions of retired names (e.g. inside `db/` migrations that have
  already shipped, or inside the legacy `k8s/legal-orchestrator/` tree) are
  out of scope of this contract. The contract applies to *new* IterLaw infra
  surface only.
