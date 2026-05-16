# IterLaw Sprint 20 — GDPR retention + DSR queue (DB + pure TS)

## Delivered

- **Migration `111_sprint20_gdpr_retention.sql`**
  - `data_retention_policies`: `resource_type`, `category`, `retention_days` (CHECK > 0), admin-only RLS.
  - `gdpr_subject_requests`: `EXPORT` / `ERASURE` / `RECTIFICATION`, status lifecycle, FK to `users`, self read/insert + admin update/delete RLS.
- **Pure helpers** under `apps/legal-orchestrator/src/gdprRetention/` for DSR type guards and UTC retention deadline math (in-memory until wired to Postgres).

## Verification

Run from `apps/legal-orchestrator`: `npm run typecheck`, `npm run build`, `npm test`.
