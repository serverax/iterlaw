# IterLaw Sprint 17 — Member / Auth / Subscription Foundation

**Status:** Sprint 17 delivery recorded (orchestrator-aligned slice)  
**Date:** 2026-05-16  
**Branch:** `feature/sprint-17-auth-foundation` merged to `master`  

---

## Scope delivered (this repo)

The hybrid mapping document describes new Go services (`apps/local-auth/`, `apps/local-subscription/`) and Temporal wiring. This sprint slice **lands the database and pure TypeScript foundation inside `apps/legal-orchestrator`**, consistent with the existing migration chain and RLS posture (`106_enable_rls.sql`).

### Database (migration `108_sprint17_member_auth_foundation.sql`)

- `public.users.password_hash` — optional column for local password material (scrypt at app layer).
- `public.user_subscriptions` — one row per user; `tier` in `FREE` | `PRO` | `ENTERPRISE`; `rate_limit_requests_per_day` aligned to tier (NULL = unlimited for ENTERPRISE).
- `public.user_api_keys` — stores **hashed** API key material only (`key_hash`, `name`, `revoked_at`).
- **RLS** enabled on both new tables; policies follow the same **self + admin** pattern as `public.users` (using `current_app_user_id()` / `current_app_user_is_admin()` from migration 106).

### Application library (`src/memberAuth/`)

- Password hashing / verification (`scrypt$…` format).
- Subscription tier helpers and **per-day rate budget** mapping (FREE=10, PRO=1000, ENTERPRISE=unlimited).
- In-memory **`TierDailyRateLimiter`** for unit tests and future Zone-1 edge enforcement.
- **HS256 JWT** access + refresh helpers (no third-party JWT dependency); rotation via refresh token.
- API key **hash + verify** (SHA-256 with internal pepper; raw keys never persisted).

### Tests

- **40** Vitest cases in `src/tests/sprint17MemberAuthFoundation.test.ts` (password, tiers, API key hash, JWT, rate limiter).
- **6** migration contract tests in `src/tests/migrationSprint17MemberAuthFoundation.test.ts`.

**Orchestrator suite:** 1315 tests PASS (includes new tests).  
**Root Jest:** 185 tests PASS.

---

## Explicitly not in this slice

- Go binaries under `apps/local-auth/` and `apps/local-subscription/` (deferred; mapping remains authoritative for a later infra sprint).
- Temporal workflow auth gate and live HTTP `/signup` `/login` routes (requires service wiring and operator runbooks).

---

## Operator notes

- Apply migration **108** after **107** on environments that already ran the 104→107 chain.
- Until HTTP handlers exist, user registration flows continue to use existing application gates; password column is additive and nullable.

---

## Verification commands (local)

```powershell
cd C:\Users\kalsh\projects\iterlaw\apps\legal-orchestrator
npm run typecheck
npm test
```

---

## Tag

- `sprint-17-complete` — annotated; points at the merge commit that lands this work on `master`.

This report does **not** assert production deployment or live-environment verification.
