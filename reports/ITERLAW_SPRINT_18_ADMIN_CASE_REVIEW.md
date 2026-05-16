# IterLaw Sprint 18 — Admin Case Review (Orchestrator + Web Slice)

**Status:** Delivered in-repo (no separate Go services)  
**Date:** 2026-05-16  

---

## Summary

Sprint 18 from `SPRINTS_16_TO_57_HYBRID_MAPPING.md` calls for admin UI, approval queue API, and `case_approvals` storage. This slice implements:

1. **PostgreSQL** — `public.legal_case_approvals` (maps to spec **case_approvals**), FK to `legal_case_records` and `users`, **admin-only RLS** using `current_app_user_is_admin()` from migration 106.
2. **Next.js API** — `GET /api/cases`, `GET /api/cases/history`, `POST /api/cases/:id/approve`, `POST /api/cases/:id/reject` guarded by `Authorization: Bearer` + `ITERLAW_ADMIN_API_TOKEN` (fail-closed if unset or too short).
3. **In-memory queue** — `lib/admin/caseApprovalQueue.ts` for demo data and tests until handlers persist to Postgres.
4. **React components** — `AdminCaseList`, `AdminCaseDetail`, `RejectionReasonModal`, `ApprovalHistoryList` under `components/admin/`.
5. **Admin pages** — `/admin/dashboard`, `/admin/cases`, `/admin/cases/[id]`, `/admin/history` (require `ITERLAW_ADMIN_UI_ENABLED=1` or they `notFound()`).

---

## Tests

| Suite | New / touched | Result |
|-------|-----------------|--------|
| Root Jest | +36 (admin queue, auth helper, `/api/cases`, components) | 221 total PASS |
| Orchestrator Vitest | +4 migration contract | 1319 total PASS |

Temporal pause/resume and live workflow callbacks are **out of scope** for this slice (documented in mapping as Zone 2).

---

## Environment

- `ITERLAW_ADMIN_API_TOKEN` — required for admin API routes (min 8 chars).
- `ITERLAW_ADMIN_UI_ENABLED=1` — required to render `/admin/*` pages.

This report does **not** assert production deployment.
