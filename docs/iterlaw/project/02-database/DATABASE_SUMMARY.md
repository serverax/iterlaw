# IterLaw — Database Summary

PostgreSQL + pgvector. Local / self-hosted. No public-cloud DB SDK in the browser path. Canonical migration chain lives at `apps/legal-orchestrator/db/migrations/`.

## Schemas

| Schema | Owns |
| --- | --- |
| `public` | Cross-domain RAG primitives (legal_sources, legal_documents, legal_chunks, legal_cases, legal_citations, …), pipeline audit (rag_runs, source_update_log, answer_verification_log, verified_answers_cache), and the Sprint 10 user-workspace tables (104/105/106). |
| `uk_emp_rag` | UK-employment-domain corpus tables (legal_sources, legal_documents, legal_document_chunks, legal_chunk_embeddings, legal_citations, legal_ingestion_runs, legal_answer_evidence, statutory_rate, vento_band, q_a_cache, statutory_rate_calculation_history). |

The reader queries `public.legal_chunks JOIN public.legal_domains` (canonical 001-chain). The retrieval SQL never references `uk_emp_rag.*`. Domain split is documented in `docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md`.

## Corpus / RAG concepts

- **`legal_sources`** — registered upstream publishers (legislation.gov.uk, GOV.UK, ACAS, etc.) with trust tier and refresh cadence.
- **`legal_documents`** — one row per ingested document (statute, regulation, guidance page, case). Carries `effective_date` and `superseded_by`.
- **`legal_chunks`** — token-bounded retrieval units. Carries `applicable_to` (added by 005), `embedding`, `search_vector`, `source_type`, `authority_level`.
- **`legal_chunk_embeddings`** — pgvector embeddings per chunk + model.
- **`legal_citations`** — chunk-level citation rows.
- **`legal_cases`** — UK case-law rows (migration 102; corpus).
- **`citation_registry`**, **`source_quality_scores`** — corpus quality signals.

## Audit + ingestion

- **`ingestion_jobs` / `ingestion_job_events` / `source_fetch_audit`** — per-source ingestion bookkeeping (002).
- **`rag_query_audit` / `answer_audit_log`** — query and answer audit (001).
- **`rag_runs` / `source_update_log` / `answer_verification_log` / `verified_answers_cache`** — pipeline-level audit (101 reconcile).
- **`uk_emp_rag.legal_ingestion_runs` / `legal_answer_evidence`** — UK-domain audit (003).

Six audit surfaces exist; Sprint 10 close-out picks a single canonical write target (`rag_runs` recommended) and documents the others as legacy / domain-scoped.

## Temporal model

- `legal_chunks.effective_date` — when the law came into force.
- `legal_chunks.applicable_to` — when the law stopped applying (NULL = current).
- `legal_documents.superseded_by` — document supersession chain.
- `legal_cases.decision_date` — case-level anchor.
- `applicable_on` is derived from user facts: `dismissal_date` first, then `incident_date`, `employment_end_date`, etc.

The retrieval SQL applies: `effective_date IS NULL OR effective_date <= applicable_on` AND `applicable_to IS NULL OR applicable_to >= applicable_on`.

## Sprint 10 user-workspace model (migrations 104 / 105 / 106)

User-side tables — **distinct** from the corpus.

| Table | Role |
| --- | --- |
| `users`, `workspaces`, `workspace_members` | Identity + tenant container + role mapping (migration 104). |
| `legal_case_records` | The user's IterLaw case (parent). 17-value `primary_issue` CHECK, 15-value `status` CHECK. |
| `legal_case_facts` | Structured facts per case (key/value + confidence + user_confirmed). |
| `legal_case_documents` | Uploaded documents (16-value `document_type` CHECK). |
| `legal_case_drafts` | Generated drafts (grievance / appeal / ACAS / tribunal). |
| **`legal_case_timeline`** | **USER case-journey timeline.** 15 event types. **Not** the corpus case-law history. |
| **`legal_case_sources`** | **JOIN table:** user case ↔ corpus rows (`legal_sources` / `legal_documents` / `legal_chunks` / `legal_cases`). Corpus FKs `ON DELETE SET NULL` so citation history survives corpus changes. |

All six tables carry `workspace_id NOT NULL` and (where child) `case_id NOT NULL`, both cascading from their parents.

RLS is enabled on the nine user-data tables by migration 106; corpus tables remain RLS-OFF. See [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md).

## Migration apply order

```
000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 101 → 102
(skip 103 — reserved for future GraphRAG)
→ 104 → 105 → 106
(DO NOT apply 100_iterlaw_core_rag_foundation.sql — draft / superseded)
```

Live-DB application is operator action. Full procedure: `docs/iterlaw/SPRINT_10_LIVE_DB_CLOSEOUT_OPERATOR_CHECKLIST.md`.
