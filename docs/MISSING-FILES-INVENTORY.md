# Missing Files & Incomplete Implementations

**Audit date:** 2026-05-18  
**Reference:** CURSOR-EXECUTION-ORDER-RIGHTSNOW-FULL-AUDIT.md (B.3 architecture table)

## PRD path compliance

| Component | Expected path | Status | Notes |
|-----------|---------------|--------|-------|
| Cache layer | `apps/web/lib/cache/` | **MISSING** | No cache directory; related logic may live under `apps/web/lib/qa-pool/` |
| Gov API orchestrator | `apps/web/lib/gov-apis/orchestrate.ts` | **EXISTS** | ~100 lines |
| Answer formatter | `apps/web/lib/answer/formatter.ts` | **MISSING** | `apps/web/lib/validation/formatter.ts` present (alternate) |
| AI fallback | `apps/web/lib/answer/ai-engine.ts` | **MISSING** | `apps/web/lib/ai/` module present (alternate) |
| Validation layer | `apps/web/lib/answer/validator.ts` | **MISSING** | `apps/web/lib/validation/validator.ts` present (alternate) |
| Document OCR | `apps/web/lib/documents/ocr.ts` | **MISSING** | `apps/web/lib/documents/generate.ts` present (alternate) |
| Case timeline | `apps/web/lib/case/timeline.ts` | **MISSING** | — |
| Loyalty system | `apps/web/lib/loyalty/points.ts` | **MISSING** | — |
| Solicitor escalation | `apps/web/lib/escalation/` | **MISSING** | — |
| Auth (OAuth dir) | `apps/web/lib/auth/` | **MISSING** | `apps/web/lib/auth.ts` single file (partial) |
| Rate limiting | `apps/web/lib/middleware/rate-limit.ts` | **MISSING** | — |
| Stripe integration | `apps/web/lib/payments/stripe.ts` | **MISSING** | — |

**Summary:** 1 path exact match, 4 alternate implementations, 7 fully missing.

## Critical (blocks launch)

| Item | Reason |
|------|--------|
| `apps/web/lib/cache/` | PRD answer pipeline cache layer not present at specified path |
| `apps/web/lib/case/timeline.ts` | Case timeline auto-creation not implemented at PRD path |
| `apps/web/lib/escalation/` | Solicitor escalation flow directory missing |
| `apps/web/lib/middleware/rate-limit.ts` | Rate limiting module missing at PRD path |
| `apps/web/lib/payments/stripe.ts` | Stripe integration missing at PRD path |
| TypeScript (`tsc --noEmit`) | 2 errors: missing `@/context/AuthContext`, `@/context/CaseContext` in `app/dashboard/page.tsx` |

## High priority (Sprint 3+)

| Item | Reason |
|------|--------|
| Align `answer/*` PRD files vs `validation/*` + `ai/*` | Architecture table paths do not match repo layout |
| `apps/web/lib/documents/ocr.ts` | OCR pipeline specified; only `generate.ts` found |
| `apps/web/lib/loyalty/points.ts` | Loyalty system not present |
| `apps/web/lib/auth/` directory | OAuth multi-provider layout vs single `auth.ts` |
| Prettier / YAML | `.github/workflows/01-scrape-daily.yml` (and related) fail `prettier --check` syntax |

## Medium (can defer)

| Item | Reason |
|------|--------|
| Prettier formatting (~940 files reported) | Mostly style; run `npm run format` when ready |
| npm audit (3 high, 4 low) | Dev-toolchain (`glob`, `jsdom`); fix may require breaking upgrades |
| SonarQube / Snyk / OWASP / GDPR scans | Not executed in this Phase B run |

## Assignee / ETA

(To be filled by engineering lead in Phase C.)

