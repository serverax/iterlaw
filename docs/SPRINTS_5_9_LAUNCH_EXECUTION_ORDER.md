# IterLaw — Product Sprints 5–9 Launch Execution Order

**Audience:** Cursor / Engineering / Product  
**Timeline:** Weeks 11–20 (May 2026) · **22 weeks** total program (Sprints 0–9)  
**Status:** PLANNING — not started as a unified launch track  
**Last updated:** 2026-05-16

> **Naming:** Active product name is **IterLaw**. Source PRD may say **RightsNow** — treat as legacy marketing label only. See `docs/iterlaw/project/00-index/CANONICAL_NAMES.md`.

---

## Critical: two sprint numbering systems

Do **not** confuse **product launch sprints** (this document) with **engineering roadmap sprints** (`docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`, currently through **50+** on `master`).

| Product sprint (this doc) | Weeks | Focus | Engineering overlap |
|---------------------------|-------|--------|---------------------|
| **5** | 11–12 | Dashboard, timeline, upload, deadlines | `legal_case_timeline` (105), `deadlineChecker`, doc intel **51–58** prep |
| **6** | 13–14 | Stripe, paywall, escalation | `subscription_tier` (003), Sprint **17** entitlement (planned), `SOLICITOR_REFERRAL_PARTNERS.md` |
| **7** | 15–16 | 200 Q&A audit, pen test, GDPR | `LEGAL_CONTENT_AUDIT.md`, `PENETRATION_TEST_SCOPE.md`, Sprint **20** GDPR retention |
| **8** | 17–18 | App stores, 50-user beta | `APP_STORE_SUBMISSION.md` |
| **9** | 19–20 | Production + launch marketing | `DISTRIBUTION_PLAN.md`, `infrastructure/STAGING_ENV_CHECKLIST.md` |

**Codebase Sprints 51–58** (Document Intelligence band) are a **separate** engineering batch — gated on UAT; see `feature/sprints-51-58-prep` and `docs/SPRINTS_51_58_CLARIFICATIONS.md`.

---

## Gate summary (product Sprints 5–9)

| Sprint | Gate (must pass) |
|--------|------------------|
| **5** | 10/10 documents processed; dates 100% extracted; timeline correct mobile+web; deadline colours; PDF export |
| **6** | 10 subscription flows; 5 escalations E2E; all Stripe webhooks verified; trial conversion ≥60% |
| **7** | 200/200 solicitor-approved Q&A; pen test 0 Critical, ≤3 High documented; GDPR export/delete/opt-out E2E |
| **8** | iOS + Android approved; 50+ beta signups; zero crash reports (or fixed); web live Lighthouse >90 |
| **9** | Prod green; 5 solicitor partners; marketing live; backup/DR tested; launch checklist complete |

Cross-reference **Section 16** launch gates: `docs/GATE_STATUS_BOARD.md`.

---

## Sprint 5 — Dashboard, timeline, upload, deadline tracker (Weeks 11–12)

**Gate:** Document upload identifies issues; timeline accurate; deadline alerts working.

### Deliverables

**UI** (`apps/web` primary; mobile TBD if React Native app added)

- Home dashboard: case status, single “what’s next”, recent answers, shortcuts, Free-tier banner after 3 questions
- Case timeline: vertical (mobile) / horizontal (web); event types below; PDF export for solicitor
- Deadline tracker: green / amber / red; push 7 days before; dismiss + calendar export
- Document upload: camera (mobile), drag-drop (web), OCR preview edit, issue-by-issue analysis, encrypted storage

**Backend** (prefer extend `apps/legal-orchestrator` + `apps/web/app/api/*`; legacy `backend/` is Supabase/controlled-ask — avoid duplicating)

- Date extraction: notice period, appeal deadline, hearing dates
- Cross-reference legislation (`deadlineChecker`, statutory registry)
- `deadline_alerts` table (user_id, case_id, deadline, alert_sent_at, dismissed)
- Timeline service on `legal_case_timeline` (exists — migration `105_case_workspace.sql`)
- **FCM:** Firebase Cloud Messaging — tokens, daily job, templates (7d / 1d / today)

**APIs (target)**

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/timeline` | `case_id`, pagination |
| POST | `/api/timeline/export` | PDF + signed URL |
| GET | `/api/deadline` | By case |
| POST | `/api/deadline/dismiss/{id}` | |
| POST | `/api/deadline/calendar` | iCal |
| POST | `/api/document/analyze` | OCR → issues → cached answers |
| GET/DELETE | `/api/document/{id}` | Retrieve / soft delete (7d purge) |

### Repo mapping (today)

| Spec path | Actual / planned |
|-----------|------------------|
| `backend/src/services/timelineService.ts` | **NEW** — or `apps/legal-orchestrator/src/...` + proxy from web |
| `legal_case_timeline` | **EXISTS** — `105_case_workspace.sql` |
| `documentAnalysisEngine.ts` | **PARTIAL** — `documentIntelBand.ts`, Sprints **51–58** prep |
| `mobile/src/screens/TimelineScreen.tsx` | **NOT IN REPO** — create under future `apps/mobile` or Expo |
| `web/components/Timeline.tsx` | **PARTIAL** — `ReasoningTimeline.tsx` (reasoning steps, not case events) |

### Product Owner gate tests

- 10 anonymized employment documents; OCR >95%; deadline extraction 100%; timeline order; push 7d before deadline

### Checklist file

Track tasks in: `docs/launch/SPRINT_5_CHECKLIST.md`

---

## Sprint 6 — Stripe, soft paywall, escalation (Weeks 13–14)

**Gate:** Monetization E2E; webhooks; escalation routing.

### Deliverables

- Stripe: Essential £4.99/mo, Active Case £9.99/mo; customer + subscription lifecycle; signed webhooks
- User fields: `subscription_tier`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_ends_at`, trial fields
- Escalation: confidence &lt;0.65, out-of-scope, user button, multi-issue flag
- Case summary PDF (timeline, docs, Q&A, unresolved issues — minimal PII)
- Partner routing: round-robin, email + 24h SLA
- UI: soft paywall after 3rd free answer (answer shown first); pricing comparison; subscription management; escalation flow

### Repo mapping

| Spec | Actual |
|------|--------|
| `stripeService.ts` | **NOT IN REPO** — `migrations/003_create_users.sql` has `subscription_tier` |
| Escalation | **FRAMEWORK** — `docs/SOLICITOR_REFERRAL_PARTNERS.md` |
| Paywall UI | **NOT IN REPO** |

### Checklist

`docs/launch/SPRINT_6_CHECKLIST.md`

---

## Sprint 7 — Legal audit, pen test, GDPR (Weeks 15–16)

**Gate:** 200 approved answers; pen test passed; GDPR rights E2E.

### Deliverables

- 200 Q&A audit spreadsheet → solicitor batches → sign-off evidence
- GDPR: export ZIP (JSON + PDF), delete account (48h hard purge job), analytics opt-out
- Security: TLS 1.3, HSTS, CSP, JWT 15m + refresh, CORS, rate limits
- Third-party pen test per `docs/PENETRATION_TEST_SCOPE.md`

### Repo mapping

| Spec | Actual |
|------|--------|
| `gdprService.ts` | **PARTIAL** — Sprint 20 retention (`sprint20GdprRetention.test.ts`, migration 111) |
| `LEGAL_CONTENT_AUDIT` | **FRAMEWORK** — `docs/LEGAL_CONTENT_AUDIT.md` |
| Pen test report | **OUT OF REPO** — `penetration-test/` when vendor delivers |

### Checklist

`docs/launch/SPRINT_7_CHECKLIST.md`

---

## Sprint 8 — App stores + beta (Weeks 17–18)

**Gate:** Both stores approved; 50+ beta testers; stable builds.

### Deliverables

- CI/CD: test → build iOS/Android → sign → deploy staging/prod
- App Store + Play metadata, screenshots, privacy/terms
- 50-user beta + feedback form
- Web: CDN, SEO, `rightsnow.app` → use **IterLaw** domain when confirmed

### Repo mapping

| Spec | Actual |
|------|--------|
| Store checklist | **READY** — `docs/APP_STORE_SUBMISSION.md` |
| `store-assets/` | **NOT IN REPO** — create when design ready |
| `mobile/ios`, `mobile/android` | **NOT IN REPO** |

### Checklist

`docs/launch/SPRINT_8_CHECKLIST.md`

---

## Sprint 9 — Production + launch (Weeks 19–20)

**Gate:** All systems green; 5 partners; marketing executed.

### Deliverables

- Azure App Gateway, autoscale, backups (30d), Application Insights, on-call
- Marketing: Reddit (3 posts), Twitter thread, PR, landing page, union email
- 5 solicitor partners signed + test escalation each
- Launch checklist: soft launch → public launch → week-1 triage

### Repo mapping

| Spec | Actual |
|------|--------|
| `infrastructure/production/*.tf` | **PARTIAL** — `k8s/`, `docs/infra/`, operator scripts |
| Marketing | **READY** — `docs/DISTRIBUTION_PLAN.md` |
| Partners | **FRAMEWORK** — `docs/SOLICITOR_REFERRAL_PARTNERS.md` (0/5 signed) |

### Checklist

`docs/launch/SPRINT_9_CHECKLIST.md` + `docs/launch/LAUNCH_DAY_RUNBOOK.md`

---

## Execution rules for Cursor

1. **Product Sprint 5** does not start until stakeholders confirm priority vs **engineering Sprints 51–58** (document intel) and **UAT**.
2. Prefer **one API surface**: `apps/legal-orchestrator` HTTP + `apps/web` Next.js routes — do not fork business logic into legacy `backend/` unless explicitly directed.
3. Use **IterLaw** in user-facing strings; legacy RightsNow only in quoted PRD excerpts.
4. **Firebase (FCM):** load `firebase-basics` skill before adding FCM; store keys in vault per `ITERLAW_SECRETS_RUNBOOK.md`.
5. Each product sprint: branch `feature/launch-sprint-N-*`, tests, report under `reports/`, gate sign-off in checklist markdown.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/GATE_STATUS_BOARD.md` | Live gate + phase status |
| `docs/DISTRIBUTION_PLAN.md` | Sprint 9 marketing |
| `docs/LEGAL_CONTENT_AUDIT.md` | Sprint 7 content |
| `docs/SOLICITOR_REFERRAL_PARTNERS.md` | Sprint 6 + 9 partners |
| `docs/APP_STORE_SUBMISSION.md` | Sprint 8 stores |
| `docs/PENETRATION_TEST_SCOPE.md` | Sprint 7 security |
| `docs/SPRINTS_51_58_CLARIFICATIONS.md` | Engineering doc intel (parallel) |
| `docs/iterlaw/project/05-security/RLS_SECURITY_MODEL.md` | Timeline + case RLS |

---

## Final sprint summary (product program)

| Sprint | Focus | Duration | Gate |
|--------|--------|----------|------|
| 0 | Foundations | Weeks 1–2 | Infra live |
| 1 | RAG + Q&A DB | Weeks 3–4 | 85%+ on 50 questions |
| 2 | AI gateway + validation | Weeks 5–6 | 50 answers approved |
| 3 | Auth + case management | Weeks 7–8 | E2E flow |
| 4 | UI mobile + web | Weeks 9–10 | Screens + nav |
| **5** | **Dashboard + timeline + deadlines** | **Weeks 11–12** | **Upload + timeline + alerts** |
| **6** | **Stripe + paywall + escalation** | **Weeks 13–14** | **Payments + referrals** |
| **7** | **Audit + security + GDPR** | **Weeks 15–16** | **200 Q&A + pen test + GDPR** |
| **8** | **App stores + beta** | **Weeks 17–18** | **Store approval + beta** |
| **9** | **Production + launch** | **Weeks 19–20** | **Go-live** |

**Total:** 22 weeks from program start to public launch.
