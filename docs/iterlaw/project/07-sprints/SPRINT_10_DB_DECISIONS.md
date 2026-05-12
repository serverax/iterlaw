# Sprint 10 — Locked DB Decisions

These decisions are **locked**. Do not re-litigate. Reopen only via an explicit owner decision.

## Migration owners

| Decision | Owner | Status |
| --- | --- | --- |
| `legal_cases` belongs to `apps/legal-orchestrator/db/migrations/102_add_legal_cases_table.sql` | DB Architect AIA + owner | **LOCKED — shipped** (commit `0f0697a`) |
| `legal_cases` schema scope is `public.*` (cross-jurisdiction); domain filter via `metadata` and `jurisdiction` column | DB Architect AIA | **LOCKED** |
| `legal_case_timeline` is a **user-workspace** timeline (not corpus history) | owner | **LOCKED** — landed in `105_case_workspace.sql` |
| `legal_case_sources` is a **source-traceability JOIN** table — one user case can cite many corpus rows | owner | **LOCKED** — landed in `105_case_workspace.sql` |
| Skip `103_*` (reserved for future GraphRAG, AI Architect AIA scope) | owner | **LOCKED** |
| User-workspace foundation lands at `104` / `105` / `106` (not at `102` / `103`) | owner | **LOCKED** |

## RLS

- RLS is enabled on the **nine** user-data tables only (`users`, `workspaces`, `workspace_members`, `legal_case_records`, `legal_case_facts`, `legal_case_documents`, `legal_case_drafts`, `legal_case_timeline`, `legal_case_sources`).
- Corpus tables (`legal_sources`, `legal_documents`, `legal_chunks`, `legal_cases`, …) remain RLS-OFF.
- Session GUCs: `app.user_id`, `app.user_role`, `app.workspace_id`.
- **Fail-closed**: missing or unparseable `app.user_id` → zero rows visible.
- **Solicitor** role restricted to cases where `legal_case_records.assigned_user_id = current_app_user_id()`.
- **Admin override** via `app.user_role = 'admin'` only.
- See [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md).

## Taxonomies (TEXT + CHECK, not ENUM)

Owner approved `TEXT NOT NULL` columns with `CHECK (… IN (...))` constraints — extensible via additive migrations.

- `legal_case_records.primary_issue`: 17 values (unfair_dismissal, constructive_dismissal, discrimination, redundancy, wages_pay, holiday_pay, working_time, sickness_absence, grievance, disciplinary, whistleblowing, maternity_parental, contract_terms, settlement_agreement, acas_early_conciliation, employment_tribunal, other).
- `legal_case_records.status`: 15 values (draft, intake, needs_more_facts, evidence_collection, legal_research, advice_ready, document_drafting, submitted, waiting_response, acas, tribunal_preparation, tribunal_submitted, settled, closed, archived).
- `legal_case_timeline.event_type`: 15 values (user_event, document_uploaded, document_extracted, employer_communication, employee_communication, acas_event, grievance_event, disciplinary_event, appeal_event, settlement_event, tribunal_event, deadline_reminder, system_checkpoint, system_reminder, other).
- `legal_case_documents.document_type`: 16 values.
- `legal_case_drafts.draft_type`: 8 values.
- `workspace_members.role`: 5 values (owner, admin, editor, viewer, solicitor).

## Temporal model

- `effective_from` / `effective_to` (or `effective_date` / `applicable_to` on legal_chunks) approved.
- `applicable_on` derived from facts: `dismissal_date` first, then `incident_date`, etc.
- Retrieval SQL filters on both bounds.

## GraphRAG preparation

`node_type` on graph entity tables approved as a future column (Sprint 14). The `103_*` slot is reserved for that migration. Do **not** use `103_*` for anything else.

## Deployment gate

- **Code-side DONE.** Migrations 104 / 105 / 106 committed in `c646879`. Tests + verifier extended.
- **Staging DB verification PENDING.** Must complete before production unblocks.
- **Production deployment BLOCKED** until staging verification passes (Appendix B + C of `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md`).
