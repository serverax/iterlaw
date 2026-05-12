# Sprint 10 — Live RAG retrieval + UK employment law corpus ingestion

**Status update (2026-05-12 — post-audit):**

- WP1 (DB retrieval alignment) — **DONE.** Audit confirmed
  `apps/legal-orchestrator/src/rag/postgresRetrieval.ts` already
  targets the canonical 001-chain schema (`public.legal_chunks` JOIN
  `public.legal_domains`), with `legal_pack`, jurisdiction,
  source_types, `is_active`, and temporal filters all applied. No
  `uk_emp_rag.*` reference appears in the active retrieval SQL.
- WP4 (RAG query flow) — **DONE.** `handleLegalRequest.ts` derives
  `applicable_on` from facts (dismissal_date first, incident_date
  fallback), passes it to retrieval, runs the citation gate, and
  returns `insufficient_sources` / `citation_failed` when chunks are
  absent or uncited. No external LLM call. Wiring locked in by
  `src/tests/sprint10LiveRagWiring.test.ts` (13 new tests).
- WP5 (Local LLM gateway preparation) — **NOT STARTED** (Sprint 11).
- WP2 (source seed list) + WP3 (corpus ingestion pipeline) —
  **OPERATOR-SIDE PENDING.** Code path exists; the live DB needs the
  migrations applied and at least one source seeded before retrieval
  returns rows.

This document originally read "plan only"; sections below remain the
authoritative plan for the WP2 / WP3 / WP5 work that has not yet
landed.

## Goal

IterLaw answers from trusted UK employment law database sources, with
**citations** drawn from real `legal_documents` / `legal_chunks` rows.
It does NOT answer from ungrounded LLM output. If the database has no
chunk that supports an answer, the orchestrator returns
`insufficient_sources` instead of synthesising text.

## Non-goals for Sprint 10

- No external-LLM call from the legal answer path (gateway interface
  only; see WP5).
- No public-facing UI changes.
- No SaaS / billing / auth wiring.
- No production deploy or `kubectl apply`.
- No real scraping at scale. Sprint 10 ingests a small curated seed
  set (one document per source minimum), end-to-end, against a local
  dev DB only.

---

## Work package 1 — DB retrieval alignment

**Outcome**: the runtime adapter targets the canonical schema. No
silent mismatch between writer (ingestion) and reader (retrieval).

Steps:

1. Audit the current adapter (`apps/legal-orchestrator/src/ports/pgRagPort.ts`,
   `src/rag/*`) for which schema it reads from. The 001-chain canonical
   target is `public.legal_chunks`, with cross-references into
   `public.legal_documents` and `public.legal_sources`. The
   domain-specific UK employment tables live under `uk_emp_rag.*`.
2. Decide per-query: which schema is the source of truth for *this
   sprint's seeded sources*?
   - Default: `uk_emp_rag.*` for UK employment law sources (matches
     `006_statutory_rates`, `010_legal_documents_statutory_seed`, etc.).
   - `public.legal_*` only if the document genuinely spans multiple
     domains.
3. If a mismatch exists between reader and writer, fix the **reader**.
   The schema chain is canonical (see `RAG_SCHEMA_CANONICAL_DECISION.md`)
   and must not move.
4. Document the decision in
   `docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md` under a new
   "Retrieval target" section.

Tests to add:

- Reader queries `uk_emp_rag.legal_*` when source's domain is UK
  employment.
- Reader returns empty (not error) when the schema is unpopulated.
- No SQL string in the reader references both `public.legal_chunks`
  AND `uk_emp_rag.legal_document_chunks` in the same query (the two
  are not joinable; mixing is a contract breach).

Files likely to change:

- `apps/legal-orchestrator/src/ports/pgRagPort.ts`
- `apps/legal-orchestrator/src/rag/postgresRetrieval.ts`
- `apps/legal-orchestrator/src/legal/rag/retrieveLegalContext.ts`
- `docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md`

---

## Work package 2 — Source ingestion seed list

**Outcome**: a committed, version-controlled list of the canonical
UK employment law sources, with per-source fetch metadata. No URL is
fetched at this step.

Seed list (Sprint 10 minimum coverage):

| # | Source | Document for first ingestion |
| --- | --- | --- |
| 1 | legislation.gov.uk | Employment Rights Act 1996, latest revised |
| 2 | legislation.gov.uk | Equality Act 2010, latest revised |
| 3 | GOV.UK employment guidance | "Dismissal — your rights" (`https://www.gov.uk/dismissal`) |
| 4 | ACAS | Code of Practice 1: Disciplinary and grievance procedures |
| 5 | Find Case Law (`caselaw.nationalarchives.gov.uk`) | One reference UKSC employment decision |
| 6 | EHRC | Code on employment discrimination |
| 7 | HMCTS guidance | ET1 / ET3 procedural notes |
| 8 | CAC | One representative trade-union recognition decision |

Each entry seeds a row in `uk_emp_rag.legal_sources` (provider,
canonical URL, refresh cadence, retention policy) **without** fetching
content. Content arrives in WP3.

Acceptance:

- A new migration `apps/legal-orchestrator/db/migrations/103_seed_uk_employment_sources.sql`
  inserts the 8 rows idempotently via `ON CONFLICT (canonical_url) DO UPDATE`.
- The migration is additive and reversible (down-migration drops only
  the rows it inserted, by primary key).
- `verify-iterlaw-rag-db.sh` gains a check that asserts the 8
  `source_provider` values are present in `uk_emp_rag.legal_sources`
  when a live DB is available.
- No real terms-of-service violation: each entry includes a comment
  with the upstream's published rate limit and the cron we will
  respect.

---

## Work package 3 — Corpus ingestion pipeline

**Outcome**: one document per seeded source is fetched, normalised,
chunked, citation-extracted, and stored — end-to-end against a local
dev DB only.

Pipeline stages:

1. **Fetch source metadata**. Read the `uk_emp_rag.legal_sources` row.
   Respect the source's published rate limit. Log fetch + sha256 to
   `uk_emp_rag.source_fetch_audit`.
2. **Normalise text**. HTML → readable text via the existing
   `ingestionNormaliseDocument` module. Strip nav / footer / ads.
   Preserve numbered statute sections.
3. **Chunk documents**. Reuse `chunkDocument` /
   `chunkLegalDocument` (already in `apps/legal-orchestrator/src/ingestion/`).
   Target 600–900 tokens with section-aware splits.
4. **Extract citations**. The citation extractor already exists; wire
   it to write `uk_emp_rag.legal_citations` rows referencing the
   parent document.
5. **Store source freshness**. Write `uk_emp_rag.legal_ingestion_runs`
   on every ingestion attempt (success or failure).
6. **Store legal document chunks**. `uk_emp_rag.legal_document_chunks`
   gets one row per chunk; embeddings are deferred to WP4.

Rules:

- **No uncontrolled scraping.** Per-source allow-list. No following
  arbitrary links. No User-Agent that hides we are a tool —
  `User-Agent: IterLaw/0.1 (+https://github.com/serverax/iterlaw)`.
- **No write to `public.legal_*`** in this sprint. The 001-chain
  canonical tables remain reserved for cross-domain RAG; UK
  employment law lives in `uk_emp_rag.*` only.
- **No write to production DB** during Sprint 10. Local dev DB only,
  with the migration chain applied via `psql -f`.

Files likely to change:

- `apps/legal-orchestrator/src/ingestion/run.ts` (CLI entrypoint)
- `apps/legal-orchestrator/src/ingestion/fetcher.ts` (new)
- `apps/legal-orchestrator/src/ingestion/sourceRegistry.ts`
- `apps/legal-orchestrator/scripts/ingest-cli.ts`

---

## Work package 4 — RAG query flow

**Outcome**: the orchestrator answers from cited chunks when chunks
exist; refuses cleanly when they do not.

Flow per question:

1. `classifyRequest` (existing) — determines whether the question is
   in-domain.
2. `extractFacts` (existing) — pulls jurisdiction, employer name,
   employment dates, etc., from the question text.
3. `immediateRiskCheck` (existing) — flags limitation deadlines and
   short-circuits to advice if the deadline is imminent.
4. `retrieveLegalContext` (rewritten) — runs a vector + FTS hybrid
   query against `uk_emp_rag.legal_document_chunks`. Returns top-K
   chunks plus their citations.
5. **Citation gate** (existing) — every returned chunk MUST have a
   `legal_documents.canonical_url`. Chunks without provenance are
   dropped.
6. `synthesiseAnswer` (new, deterministic only in Sprint 10) — assembles
   a structured envelope: `{ answer, citations[], confidence,
   temporal_filter, source_provider[] }`. **No LLM call yet** — the
   answer text is a templated "From source X, section Y: …" rendering.
   The LLM-driven free-text answer is Sprint 11.
7. If no chunks pass the citation gate, return
   `answerStatus: "insufficient_sources"`. This is the existing
   behaviour and MUST remain the safe default.

Tests:

- Empty corpus → `insufficient_sources`.
- Single chunk with valid citation → `answerStatus: "ok"` with the
  chunk's source_url in `citations[]`.
- Two chunks, one without a citation → only the cited chunk reaches
  the answer.
- Temporal-filter test: a chunk with `applicable_to` in the past must
  not appear in answers to a "current law" question.

---

## Work package 5 — Local LLM gateway preparation

**Outcome**: the *interface* for a future bounded synthesis call is
defined. **No external LLM is invoked.** No `openai` / `anthropic` /
`gemini` package is imported.

Steps:

1. Tighten the existing `apps/legal-orchestrator/src/legal/llm/localOllamaGateway.ts`
   into a typed interface: `synthesise(input: SynthesisInput): Promise<SynthesisResult | "OLLAMA_UNAVAILABLE">`.
2. Default implementation returns `OLLAMA_UNAVAILABLE`. Sprint 11 will
   replace this with a real call to an internal Ollama / Bifrost
   endpoint reached over the cluster network.
3. The orchestrator's `synthesiseAnswer` from WP4 accepts the
   gateway as an injected dependency. When the gateway returns
   `OLLAMA_UNAVAILABLE`, fall back to the deterministic templated
   answer. **Either way the answer carries citations.**

Hard rules:

- No fetch / axios / node-fetch / undici / openai / anthropic /
  google-genai import in `apps/legal-orchestrator/src`. The repo
  verifier asserts this and FAILs on any new dep.
- The gateway is the ONLY potential network surface, and it is
  probe-only in Sprint 10.

---

## Work package 6 — Tests

| Test | File | Type |
| --- | --- | --- |
| Reader queries `uk_emp_rag.legal_document_chunks` for UK employment domain | `apps/legal-orchestrator/src/tests/retrievalSchemaMapping.test.ts` (new) | unit |
| Seeded sources present in 103 migration | `apps/legal-orchestrator/src/tests/migrationSprint10SeedSources.test.ts` (new) | unit (static SQL inspection) |
| End-to-end: stub fetcher → normalise → chunk → store → retrieve → answer with citations | `apps/legal-orchestrator/src/tests/sprint10IngestionEndToEnd.test.ts` (new) | integration (in-process pg via testcontainers OR mocked port) |
| Citation gate blocks chunks without `canonical_url` | `apps/legal-orchestrator/src/tests/citationGateChunks.test.ts` (new) | unit |
| No-source refusal: orchestrator returns `insufficient_sources` when retrieval returns `[]` | extend `handleEmploymentLawQuestion.test.ts` | unit |
| Temporal filter: `applicable_to` in past is excluded | extend `module_temporalFilter.test.ts` | unit |
| Static safety: no `openai`/`anthropic`/`fetch(` etc. anywhere in `src/` | extend the existing static-safety test | unit |

**No real network call in tests.** All fetchers are mocked behind a
typed port. `nock` / `msw` is NOT introduced — the codebase already
uses port/adapter inversion; we mock at the port boundary.

---

## Work package 7 — Exit criteria

Sprint 10 is done when ALL of the following are true.

- [ ] At least one seeded employment-law source row exists in
  `uk_emp_rag.legal_sources` (via migration 103).
- [ ] At least one corresponding `legal_documents` + several
  `legal_document_chunks` rows exist after the ingestion CLI is run
  against a local dev DB.
- [ ] A test question (e.g. "What is the qualifying service for
  unfair-dismissal protection?") returns a cited chunk in the
  orchestrator's `citations[]`.
- [ ] The no-source path still refuses safely
  (`answerStatus: "insufficient_sources"`).
- [ ] All tests pass (current 481 + Sprint 10 additions).
- [ ] `verify-iterlaw-repo.sh`, `verify-iterlaw-rag-db.sh`,
  `verify-iterlaw-canonical-namespaces.sh` all PASS.
- [ ] No real network call in any test.
- [ ] No external LLM dependency introduced.
- [ ] No real secret committed.
- [ ] No production DB touched.
- [ ] No `kubectl apply` / `helm install` / `git push` performed by
  the agent.

---

## Sprint 10 deliverables checklist

1. `apps/legal-orchestrator/db/migrations/103_seed_uk_employment_sources.sql`
2. `apps/legal-orchestrator/src/ports/pgRagPort.ts` (audit + correct schema target)
3. `apps/legal-orchestrator/src/rag/postgresRetrieval.ts` (real hybrid retrieval against `uk_emp_rag`)
4. `apps/legal-orchestrator/src/legal/rag/retrieveLegalContext.ts` (replace `not_wired` with real path)
5. `apps/legal-orchestrator/src/ingestion/fetcher.ts` (typed port; default impl is `unavailable`)
6. `apps/legal-orchestrator/src/legal/llm/localOllamaGateway.ts` (typed interface only, default `OLLAMA_UNAVAILABLE`)
7. `apps/legal-orchestrator/scripts/ingest-cli.ts` (local-dev ingestion runner)
8. New tests listed in WP6.
9. Updated `RAG_SCHEMA_CANONICAL_DECISION.md` with the retrieval-target section.
10. Updated `ITERLAW_PROJECT_STATUS.md` marking Sprint 10 complete.

## Out of scope for Sprint 10

- Free-text LLM synthesis (Sprint 11).
- Document OCR / camera uploads (Phase 3, much later).
- AIA layer (post-MVP).
- Member / billing (post-MVP).
- Backup go-live operator work (Sprint 12).
