# IterLaw Project Status and Go-Live Sprint Handoff

Last updated: 12 May 2026

## Current status

IterLaw is the active UK employment law AI assistant project.

OrdinoxAI is the wider AI management platform/company brain.

Do not use RightsNow as the active project name. RightsNow is legacy only.

## Completed sprints

### Sprint 1-8: Core engine foundation
Status: DONE

Completed:
- Legal orchestrator foundation.
- Health and readiness endpoints.
- Legal safety gates.
- Citation-required answer flow.
- Mock-safe RAG service.
- No direct external LLM calls from the orchestrator.
- WASM rule-runner baseline.
- Namespace and K3s infra baseline.
- Postgres and RAG schema foundation.
- Internal synthesis worker separation.
- Fast legal answer planner.

### Sprint 9: Rename and schema alignment
Status: DONE / QA PASSED

Completed:
- RightsNow renamed to IterLaw across active runtime/config files.
- Package scopes moved from @rightsnow/* to @iterlaw/*.
- package-lock files regenerated.
- Added migration 102_add_legal_cases_table.sql.
- Added legal_cases to the canonical RAG schema decision.
- Updated RAG DB verifier for migration 102.
- Added LF policy through .gitattributes.
- Shell script syntax checks passed.
- Secret scan found no real secrets.
- Tests passed: 481 tests / 44 files.
- Legal-orchestrator typecheck and build passed.

## Blockers solved

Solved:
- Git rebase conflict against origin/master.
- Local and origin/master aligned.
- pgvector prerequisite made explicit.
- RAG temporal retrieval tests fixed.
- Ingestion compatibility tests fixed.
- Namespace drift reduced.
- Direct model usage removed from legal-orchestrator.
- .claude/ and iterlaw.code-workspace added to ignore policy.
- No real secrets found in tracked files.

## Remaining blockers / risks

Known remaining items:
- Backup verifier has one known warning: Storage Box CIDR is not pinned yet.
- Backup uploader image digest/tag still needs build and pinning.
- Live DB migration has not been executed against production.
- Live RAG retrieval is not yet fully wired to production Postgres.
- No live scraping should run until source controls, audit, and rate limits are confirmed.
- SaaS, payment, member account, admin panel, and production auth hardening are not finished.
- AIA layer is not fully implemented.

## Remaining sprints to go live

Estimated remaining: 6 sprints.

### Sprint 10: Live RAG DB wiring
Status: PARTIAL — code-side DONE, operator-side PENDING.

Code-side completed (audit + lock-in this update):
- `apps/legal-orchestrator/src/rag/postgresRetrieval.ts` queries the canonical 001-chain schema (`public.legal_chunks` JOIN `public.legal_domains`). No `uk_emp_rag.*` reference in the active retrieval SQL.
- Filters applied: `legal_pack` (domain_code), jurisdiction, source_types, `is_active = true`, temporal `effective_date <= applicable_on` AND `applicable_to IS NULL OR applicable_to >= applicable_on`.
- Citation evidence returned: chunk_id, document_id, title, url, citation_label, section_reference, paragraph_reference, authority_level, source_type, effective_date, applicable_to.
- `applicable_on` derived from `dismissal_date` first; `incident_date` is the documented fallback.
- Mock-safe paths: `db_url_missing`, `pg_driver_unavailable`, `query_failed`. Errors sanitised — connection string never appears in thrown messages.
- Zero-citation blocking preserved: empty chunks → `insufficient_sources`; chunks without citations → `citation_failed`. No external LLM call.
- Sprint 10 wiring contract locked in by `apps/legal-orchestrator/src/tests/sprint10LiveRagWiring.test.ts` (13 tests). Total: 494 tests / 45 files PASS.

Operator-side pending (Sprint 10 → DONE):
- Apply the canonical migration chain to a live dev/staging DB: 000, 001–010, 101, 102.
- Verify `pgvector` extension is present (000_pgvector_prerequisite).
- Seed at least one UK employment source row in `public.legal_sources` (or via 103 if added in a follow-up).
- Run a smoke test against the live dev DB only — never production.
- Keep zero-citation blocking active.

No deploy, no production `psql`, no `kubectl apply`, no real secrets created.

### Sprint 11: Official source ingestion
Goal:
- Add controlled ingestion for GOV.UK, legislation.gov.uk, ACAS, tribunal/case-law sources.
- Store provenance, citations, effective dates, and audit records.
- No live scraping without rate limits and allow-list checks.

### Sprint 12: Answer quality and legal safety
Goal:
- Improve source ranking.
- Improve citation selection.
- Add answer audit trail.
- Block weak or uncited legal answers.
- Add “needs more facts” handling for complex employment issues.

### Sprint 13: User app and case workspace
Goal:
- ChatGPT-style user interface.
- My cases section.
- Case history.
- Document upload flow.
- Safe legal answer rendering with citations.

### Sprint 14: SaaS, auth, admin, billing
Goal:
- Member registration.
- Login.
- Subscription/payment.
- Admin dashboard.
- Usage limits.
- Email notifications.

### Sprint 15: Production hardening and go-live
Goal:
- CI/CD.
- Backups.
- Restore drill.
- Security scan.
- Monitoring.
- Rate limiting.
- Final deployment to K3s.
- Go-live checklist.

## Go-live definition

IterLaw is not go-live ready until:

- All tests pass.
- Secret scan passes.
- Infra verifiers pass.
- RAG DB is live and backed up.
- Retrieval returns cited official sources.
- Legal answers are blocked when no source exists.
- User app works end-to-end.
- Auth and payments are secure.
- Backup and restore are tested.
- Monitoring is enabled.
- Deployment is repeatable from GitHub.

## Rule for Claude, Cursor, and AIA

Before starting work, always read this file:

ITERLAW_PROJECT_STATUS.md

Then report:
- What sprint you are working on.
- What files you will touch.
- What checks you will run.
- Whether the task is safe to commit.
- Whether the task is safe to push.

Do not push, deploy, create secrets, or run production DB commands unless explicitly instructed.
