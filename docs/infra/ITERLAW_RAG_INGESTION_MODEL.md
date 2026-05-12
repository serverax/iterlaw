# IterLaw — RAG Ingestion Model

This document describes how legal sources flow from upstream URLs into
the orchestrator's PostgreSQL/pgvector schema. Read together with
`infra/iterlaw/database-contract.md` (which catalogues the underlying
tables) and `infra/iterlaw/synthesis-llm-contract.md` (which describes
how the retrieved chunks are later combined with an internal model via
the synthesis-worker).

## Ingestion stages

```
   Trusted source registry
   (apps/legal-orchestrator/src/ingestion/statutorySources.ts)
              |
              v
   fetchSource  (out of scope this sprint — disabled by default)
              |
              v
   normaliseDocument   ── strip HTML / control chars / credentials
              |          ── hash cleanText (SHA-256)
              v
   chunkLegalDocument  ── markdown-aware, words-bounded, overlap-aware
              |          ── captures headingPath + sectionReference
              v
   extractCitations    ── regex passes for statute names, ACAS code,
              |          ── section refs, regulations, neutral citations
              v
   ragRepository       ── parameterized SQL upserts to:
                          ── legal_sources
                          ── legal_documents
                          ── legal_chunks
                          ── legal_citations
                       ── no DELETE; supersession via UPDATE is_active
```

## Source trust model

Every source must pass `validateTrustedSource` (in `sourceRegistry.ts`)
before any document from it is normalised. The validator enforces:

- `enabled: true`,
- a known `sourceType` (`legislation`, `gov_guidance`, `acas_guidance`,
  `tribunal_case`, `hmcts`, `internal_template`, ...),
- a known `trustLevel`,
- `https://` `baseUrl` with no embedded credentials and no `javascript:`,
  `file:`, `data:`, or `ftp:` schemes.

Each candidate document URL must additionally pass
`assertUrlBelongsToSource` (same module). That function rejects
cross-origin URLs, credential URLs, non-HTTPS callers, and anything not
within the source's base origin.

The seed registry under `src/ingestion/statutorySources.ts` is the
single source of truth for which upstream domains IterLaw will eventually
fetch from. It enumerates nine UK employment-law sources with explicit
`refresh_frequency`, `effective_date_strategy`, and `citation_required`
flags. Every entry currently flags `citation_required = true`.

## Citation requirement

The orchestrator's policy gate (existing modules in
`src/modules/citationVerifier.ts` and `src/pipeline/verifyCitations.ts`)
rejects an answer that does not include a citation drawn from
`legal_citations`. Therefore the ingestion path is responsible for
populating `legal_citations` whenever it inserts `legal_chunks`. The
`extractCitations` pass runs on the normalised body and on each chunk;
duplicates are collapsed.

## Temporal filtering model

Chunks carry two date fields that the retrieval adapter
(`src/rag/postgresRetrieval.ts`) honours when a query supplies
`filters.applicable_on`:

| Column              | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `effective_date`    | First date this chunk's content is in force.                              |
| `applicable_to`     | Last date this chunk's content remains in force (NULL = open-ended).      |

A chunk is included in retrieval iff:

```
(effective_date IS NULL OR effective_date <= applicable_on)
  AND (applicable_to IS NULL OR applicable_to  >= applicable_on)
```

The orchestrator derives `applicable_on` from facts (priority order
`dismissal_date → resignation_date → discrimination_act_date →
incident_date → …`) via `src/rag/temporalFilter.ts`. Chunks with no
recorded dates remain eligible for every query — best-effort over silent
exclusion.

### effective_from / effective_to rules at write time

- `effective_date` — set to the value supplied by the
  `effective_date_strategy` of the source's registry entry. For
  `uprate_annual_april`, the operator passes the uprate-effective date
  (typically the 1 April). For `in_force_on_amendment`, it is the
  legislation.gov.uk in-force-from date for the relevant version.
- `applicable_to` — set ONLY when a later, replacing version is being
  ingested. The repository does NOT compute this automatically. The
  recommended pattern is: ingest the new version with
  `effective_date = X`; then call `markDocumentSuperseded(oldDocumentId)`
  AND issue a chunk-level update to set `applicable_to = X - 1 day` on
  the old version's chunks. The latter update is a future addition — for
  now operators set `applicable_to` at insert time on the old version.

## Dry-run mode

`npm run ingest:dry-run` runs the entire normalise → chunk → extract →
"plan repository inserts" pipeline against a local fixture
(`db/fixtures/era-1996-s95.md` by default). It:

- reads the fixture from the local filesystem;
- validates the registry entry and the canonical URL;
- prints the chunks, citations, and the SQL operations that WOULD be
  issued by `ragRepository.upsertLegalSource` /
  `upsertLegalDocument` / `insertLegalChunks` / `insertLegalCitations`;
- exits without opening a database connection.

A second flag (`--write`) is reserved for the live path, but the script
**refuses to write** unless `INGEST_DRYRUN_LIVE=true` is also set in the
environment, and even then it currently exits non-zero with a message
explaining that live wiring is gated on operator review. There is no
way to write to the database through this script in this sprint.

## Why DB writes are not enabled by default

1. **pgvector image** is freshly required (migration 000) but not yet
   running in any environment under this branch. Writing rows that
   reference a not-yet-created database is the wrong order of operations.
2. **Source freshness** for statutory rates (NMW, redundancy cap,
   Vento bands) needs an operator-reviewed uprate cadence — the
   `effective_date_strategy` values in the registry are intent, not yet
   wired to a calendar. An automated writer would overwrite live rows
   on every CI run; that's not acceptable.
3. **Citation completeness** — every chunk must enter the database with
   at least one citation row. The extractor is regex-based and will
   miss novel statute names. Until coverage is reviewed, writes stay off.
4. **Schema duality** (`public.legal_*` runtime vs `uk_emp_rag.*`
   UK-slice) — the runtime targets `public.legal_*`; once the contract is
   finalised the writer needs to know which schema it owns. See
   `infra/iterlaw/database-contract.md`.

## Later: Ollama / Bifrost gateway integration

The orchestrator never calls a language model directly. When retrieval
returns chunks, the orchestrator pushes a synthesis request onto the
Redis stream `iterlaw:synthesis:requests` (see
`infra/iterlaw/synthesis-llm-contract.md`). The `synthesis-worker`
picks the request up and routes it to the internal model endpoint
(currently `http://ollama.ordinox-ai.svc.cluster.local:11434` —
temporary; long-term destination is a dedicated `iterlaw-llm` namespace
behind a Bifrost-style gateway).

The synthesis-worker is allowed three named UK-employment models:

| Task                  | Model                              |
| --------------------- | ---------------------------------- |
| Answer synthesis      | `uk-employment-qwen:latest`        |
| Drafting              | `uk-employment-drafting:latest`    |
| Document extraction   | `uk-employment-document:latest`    |

The RAG layer documented here is upstream of all model routing. Even if
the synthesis-worker is in `MODEL_MODE=disabled`, the ingestion path,
the temporal filter, the citation verifier, and the policy gate
continue to work — they return `synthesis_unavailable` to the caller
rather than fabricating an answer.

## Forbidden in this layer

- HTTP fetching from inside `src/ingestion/{normaliseDocument,chunkDocument,citationExtractor,ingestionPipeline,sourceRegistry,types}.ts` or `index.ts` — enforced by the Sprint 11 static safety test (`src/tests/ingestion.sprint11.framework.test.ts`).
- LLM client imports anywhere in `apps/legal-orchestrator/src/` — enforced by `scripts/infra/verify-iterlaw-repo.sh`.
- Unparameterised SQL anywhere in `src/rag/ragRepository.ts` — every value enters via `client.query(sql, params)` as `$N`.
- `DELETE FROM legal_*` in any code path. Supersession is `UPDATE … is_active = false`.
