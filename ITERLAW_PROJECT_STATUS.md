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
Goal:
- Wire legal-orchestrator retrieval to the live Postgres RAG DB.
- Apply migrations safely.
- Verify pgvector.
- Run smoke tests against non-production first.
- Keep zero-citation blocking active.

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
