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

## Future / target tables (NOT yet implemented)

The platform roadmap (Sprints 18–57) adds the table groups below. **None of these exist in the database today.** They are referenced by the architecture docs and the future-sprint roadmap, but not in any committed migration.

### Platform tables (subscription gating)

| Table | Purpose |
| --- | --- |
| `platform_countries` | Registered country codes + default language + status. |
| `platform_modules` | Registered `(country_id, domain_code)` modules + status (`disabled` / `beta` / `general_availability` / `deprecated`). |
| `user_subscriptions` | Per-user subscription rows: `(user_id, country_id, module_id, plan_tier, status, starts_at, ends_at)`. |
| `subscription_events` | Billing event audit (upgrade / downgrade / cancel / past_due / restored). |

### User workspace extensions

| Table | Purpose |
| --- | --- |
| `case_deadlines` | Statutory deadlines per case (ACAS clock, tribunal limitation, statute of limitations). |
| `question_history` | Per-user question records (timestamp, module, status, refusal reason, cited chunk ids). Module-scoped. |
| `user_loyalty` | Per-user loyalty / engagement record. |
| `loyalty_transactions` | Per-event loyalty ledger. |

### Law module engine tables

See [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md).

| Table | Purpose |
| --- | --- |
| `law_category_modules` | Topic groupings inside one module (e.g. "Dismissal", "Discrimination"). |
| `law_section_modules` | Addressable law-section rows (act + section ref + plain-English + tags + jurisdiction + effective dates + `verification_status`). |
| `module_qa_cache` | Pre-built Q&A entries (question + embedding + cited chunk ids + confidence + `verification_status` + `serve_count`). |
| `answer_generation_queue` | Background queue feeding `module_qa_cache`. |

### Approval + governance

| Table | Purpose |
| --- | --- |
| `human_approval_queue` | Items requiring human review: low-confidence answers, new AI-generated sections, law amendments, solicitor referrals, urgent deadlines, security events, refunds, GDPR / DSAR requests. |

### Knowledge graph / fact registry (deterministic facts)

| Table | Purpose |
| --- | --- |
| `legal_fact_registry` | Deterministic legal facts keyed by `(country, module, fact_code)` (qualifying period, statutory caps, ACAS clock, etc.). Used by Tier 2 / knowledge agent to serve deterministic facts without an LLM call. |
| `legal_fact_provenance` | Audit-trail mapping each fact value to the source `legal_documents` / `legal_chunks` row and the human reviewer who approved it. |

### Document layer (extensions over current `legal_case_documents`)

| Table | Purpose |
| --- | --- |
| `case_document_versions` | Per-version document body + paragraph citation map. |
| `case_document_paragraphs` | Paragraph-level citation index (`paragraph_id`, `legal_citation`, `confidence`, `requires_review`). |

### RLS expectations on the future tables

- All user-private tables (`user_subscriptions`, `case_deadlines`, `question_history`, `user_loyalty`, `loyalty_transactions`, `case_document_versions`, `case_document_paragraphs`) carry `user_id` and / or `workspace_id` columns.
- Each ships with RLS policies reusing the Sprint 10 helpers (`current_app_user_id()`, `current_user_in_workspace(uuid)`, `current_user_can_write_workspace(uuid)`).
- `human_approval_queue` is admin-scope read/write — protected via `current_app_user_is_admin()`.
- Corpus / module-engine tables (`platform_countries`, `platform_modules`, `law_category_modules`, `law_section_modules`, `module_qa_cache`, `answer_generation_queue`, `legal_fact_registry`, `legal_fact_provenance`) are corpus-scope and remain **RLS-off** (read-only to the app role).

### Country / module scoped RAG

Retrieval is **country + module scoped** (see [`../03-rag/RAG_SUMMARY.md`](../03-rag/RAG_SUMMARY.md)). Every retrieval call carries `(country_id, module_id)` and the SQL filters on the corresponding domain / jurisdiction columns. Cross-module retrieval is not allowed in the answer path without an explicit federated flag (none exists today).

## Status

- Sprint 10 user-workspace + RLS migrations: **PASS** in repo + local Docker. **Real staging DB verification: PENDING.**
- Sprint 11 added no migrations.
- All "future / target" tables above: **NOT IMPLEMENTED.** They are documented to anchor the architecture, not to claim delivery.
- Production: **BLOCKED.**
