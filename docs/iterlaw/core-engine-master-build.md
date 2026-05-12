# IterLaw — Core Engine Master Build

## What was built in this sprint

This sprint executes the Master Order phases 1–8: it lays down the
**new** single-namespace IterLaw layout, the canonical Master-Order RAG
foundation migration, the typed Legal contracts, the official-sources
seed, the `rag_runs` repository, the orchestrator entry point
(`handleEmploymentLawQuestion`), the local-Ollama gateway placeholder,
and this doc. No row was inserted into a real database. No public
ingress was created. No real secret was committed. No external LLM
call exists anywhere in the new code.

### New files (per the Master Order)

#### Phase 1 — Kubernetes (single namespace `iterlaw`)
- `k8s/iterlaw/00-namespace.yaml`
- `k8s/iterlaw/10-postgres-pvc.yaml`
- `k8s/iterlaw/11-postgres-secret.example.yaml` (placeholders only)
- `k8s/iterlaw/12-postgres-deployment.yaml` (pgvector/pgvector:pg16)
- `k8s/iterlaw/13-postgres-service.yaml` (ClusterIP, 5432)
- `k8s/iterlaw/20-legal-orchestrator-configmap.yaml`
- `k8s/iterlaw/21-legal-orchestrator-secret.example.yaml` (placeholders only)
- `k8s/iterlaw/22-legal-orchestrator-deployment.yaml`
- `k8s/iterlaw/23-legal-orchestrator-service.yaml` (ClusterIP, 3012)
- `scripts/infra/verify-iterlaw-infra.sh`

#### Phase 2 — Database
- `apps/legal-orchestrator/db/migrations/100_iterlaw_core_rag_foundation.sql`
  (file numbered `100_` to coexist with the prior 000–010 series; see
  "Schema duality" below.)
- `scripts/infra/verify-iterlaw-rag-db.sh`

#### Phase 3 — Types
- `apps/legal-orchestrator/src/legal/types/legalSource.types.ts`
- `apps/legal-orchestrator/src/legal/types/legalDocument.types.ts`
- `apps/legal-orchestrator/src/legal/types/legalRag.types.ts`
- `apps/legal-orchestrator/src/legal/types/legalAnswer.types.ts`
- `apps/legal-orchestrator/src/legal/types/legalRules.types.ts`
  (interface + TypeScript placeholder; WASM swap-in later)

#### Phase 4 — Seed
- `apps/legal-orchestrator/src/legal/seeds/officialSources.seed.ts`
  (6 official UK employment-law sources; no others)

#### Phase 5 — Repository
- `apps/legal-orchestrator/src/legal/repositories/ragRunRepository.ts`
  (parameterised SQL only; returns `DB_NOT_WIRED` when no client is
  supplied — never a fake success)

#### Phase 6 — Orchestrator
- `apps/legal-orchestrator/src/legal/orchestrator/handleEmploymentLawQuestion.ts`
  (returns `answerStatus: "insufficient_sources"` with NO citations
  and NO model call — Master-Order honest fallback)

#### Phase 7 — Ollama gateway
- `apps/legal-orchestrator/src/legal/llm/localOllamaGateway.ts`
  (reads `OLLAMA_BASE_URL`, defaults to
  `http://ollama.ordinox-ai.svc.cluster.local:11434`,
  exposes `getOllamaBaseUrl`, `checkOllamaHealth`, `listLocalModels`;
  every failure path returns `OLLAMA_UNAVAILABLE` with a reason
  string — no fake success)

## What is NOT built yet

- No real ingestion of legislation.gov.uk / GOV.UK / ACAS / EHRC /
  HMCTS / Find Case Law. Source registry is seeded but no scraping
  code is wired.
- No retrieval implementation against the new tables. The orchestrator
  currently returns `insufficient_sources`.
- No verified-answer cache writer. The migration creates the table but
  no code populates it.
- No WASM rule modules — `legalRules.types.ts` ships a TypeScript
  placeholder implementing `LegalRulesEngine`; WASM modules will
  replace methods one at a time in a later sprint, behind the same
  interface.
- No `kubectl apply` was run against the live AKS cluster by this
  sprint. The manifests are validated by dry-run only.

## How the infrastructure works

- **Namespace:** `iterlaw` (single namespace, Master-Order canonical).
  All Postgres + orchestrator pods live here. The previous split
  (`iterlaw-ai` + `iterlaw-data`) remains under `k8s/iterlaw/<sub>/...`
  and `k8s/iterlaw-data/` and is unaffected.
- **Postgres:** `pgvector/pgvector:pg16` deployment with a 20 Gi PVC,
  reachable internally at `iterlaw-postgres.iterlaw.svc.cluster.local:5432`.
- **legal-orchestrator:** ClusterIP service on `:3012`. Reads
  `DATABASE_URL` from the example secret (placeholder values must be
  replaced via kubeseal before any real apply).
- **No public Ingress** is created.
- **EXTERNAL_LLM_ENABLED=false** is configured in the ConfigMap.

## How the RAG DB works (when applied)

```
legal_sources             (one row per upstream authority)
   │
   ├─◇  legal_documents     (one row per fetched document version)
   │     │
   │     ├─◇  legal_chunks  (one row per chunked passage, with embedding)
   │     │
   │     └─◇  legal_cases   (case-law metadata layered on a document)
   │
   ├─◇  source_update_log   (audit trail per fetch / supersession)

rag_runs                    (one row per user question)
   │
   └─◇  answer_verification_log  (verifier outcome per run)

verified_answers_cache      (full prior answers keyed by question hash)
```

`legal_chunks.embedding` is `VECTOR(1536)` with an `ivfflat`
`vector_cosine_ops` index — the pgvector path that the Master Order
specifies. The verifier script `scripts/infra/verify-iterlaw-rag-db.sh`
checks each table exists; it only runs live queries when both `psql`
and `DATABASE_URL` are available, otherwise it reports `NOT EXECUTED`.

## How Ollama will be used

The orchestrator never calls Ollama directly. The contract is:

1. Mother Brain decides whether an answer can be produced from
   cache / prepared block / deterministic rule. (`fastAnswerPlanner.ts`,
   prior sprint.)
2. If the LLM is required, the orchestrator enqueues a synthesis job
   on Redis Streams.
3. The synthesis-worker picks the job up and calls Ollama at
   `OLLAMA_BASE_URL`. The default is
   `http://ollama.ordinox-ai.svc.cluster.local:11434` — a temporary
   cross-namespace dependency. Long-term, this moves into a dedicated
   `iterlaw-llm` namespace.
4. The output is persisted as a row in `verified_answers_cache` (after
   `answer_verification_log` confirms the citation set verified) so
   future structurally-identical questions hit the cache.

`localOllamaGateway.ts` is the connectivity probe. Its public
functions return `OLLAMA_UNAVAILABLE` rather than throwing when the
endpoint is unreachable.

## How WASM will fit later

`LegalRulesEngine` is the interface:

```ts
interface LegalRulesEngine {
  checkDeadlineRisk(input: unknown): Promise<unknown>;
  rankSources(input: unknown): Promise<unknown>;
  verifyCitations(input: unknown): Promise<unknown>;
  calculateRemedy(input: unknown): Promise<unknown>;
}
```

`TypeScriptLegalRulesEngine` is the current implementation. Each
method returns `{ status: "not_implemented", check: "<methodName>" }`.
WASM modules (per `infra/iterlaw/wasm-contract.md`) will satisfy the
same interface, one method at a time, with no API change required at
the orchestrator level.

## How to verify the work

From the repo root:

```bash
bash scripts/infra/verify-iterlaw-infra.sh
bash scripts/infra/verify-iterlaw-rag-db.sh
```

`verify-iterlaw-infra.sh` reports:

- `PASS / FAIL` per manifest file in `k8s/iterlaw/`
- `PASS / NOT DEPLOYED` per cluster object in namespace `iterlaw`
- `PASS` only when there is NO Ingress in `k8s/iterlaw/*.yaml` and no
  Ingress object in the live `iterlaw` namespace.

`verify-iterlaw-rag-db.sh` reports:

- `PASS` for every required table named in the migration
- `PASS` for the `pgvector` enable and the `ivfflat` index
- `NOT EXECUTED` for the live DB section unless `psql` and
  `DATABASE_URL` are both present.

## Schema duality (read carefully before deploy)

The prior `apps/legal-orchestrator/db/migrations/001_legal_rag_foundation.sql`
created its own `legal_sources / legal_documents / legal_chunks /
legal_citations / legal_case_law / ...` tables with **different
column shapes** to the Master-Order schema. Both migrations use
`CREATE TABLE IF NOT EXISTS`, so the second migration to run is a
no-op against a table the first migration already created.

**The operator must pick one schema per database.** For a real deploy
to the new `iterlaw` namespace, apply only the Master-Order migration
(`100_iterlaw_core_rag_foundation.sql`) against a fresh Postgres
instance. Do not interleave the two schemas. This document is the
authoritative record of that decision.

## Next sprint plan

1. **Ingestion: legislation.gov.uk + GOV.UK.** Wire the source-registry
   to two real fetchers (legislation.gov.uk Atom feed + GOV.UK Content
   API). Persist documents + chunks. Verify citations re-verify.
2. **Embedding pipeline.** Decide on the embedding model (Ollama-served
   `nomic-embed-text` is the likely first choice). Generate vectors
   for every chunk. Backfill the `embedding` column.
3. **Retrieval wiring.** Update `handleEmploymentLawQuestion` so when a
   `DbClient` is supplied it runs an FTS + vector hybrid query against
   `legal_chunks` and populates `rag_runs.sources_used`. The current
   `insufficient_sources` envelope becomes the fallback, not the
   default.
4. **Citation verifier.** Implement `verifyCitations` on the
   `LegalRulesEngine` so a returned answer is rejected unless every
   cited chunk_id maps back to a row in `legal_chunks` and the chunk's
   document is `status='active'` for the relevant `applicable_on`.
5. **`verified_answers_cache` writer.** Persist accepted answers so the
   next structurally-equivalent question is answered from cache in
   tens of milliseconds.
6. **Ollama integration via synthesis-worker.** Wire the synthesis-worker
   to consume Redis Stream jobs and call Ollama at `OLLAMA_BASE_URL`.
   The orchestrator continues to emit `external_llm_used: false`.
7. **WASM rules.** Replace one `TypeScriptLegalRulesEngine` method with
   a real WASM module (start with `checkDeadlineRisk`).

## Hard rules respected in this sprint

- No deploy.
- No `kubectl apply`.
- No real secrets committed (only `REPLACE_ME_*` placeholders).
- No production DB connection.
- No external LLM call.
- No scraping.
- No UI change.
- No migration changes outside the new `100_*` file.
