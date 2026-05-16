# Risk Register — IterLaw

**Status:** LIVING DOCUMENT  
**Last updated:** 2026-05-16  
**Review cadence:** Fortnightly pre-launch; monthly post-launch

Scale: **Likelihood** and **Impact** — Low (1) / Medium (2) / High (3).  
**Risk score** = L × I (max 9).

---

## 1. Legal and regulatory

| ID | Risk | L | I | Score | Mitigation | Owner |
|----|------|---|---|-------|------------|-------|
| L-01 | Wrong answer leads user to miss limitation / appeal deadline and lose claim | 2 | 3 | 6 | Citation-locked answers; disclaimers; deadline extraction flags; solicitor referral; no "you will win" copy | Legal SME |
| L-02 | Product characterised as unregulated legal advice (SRA) | 2 | 3 | 6 | "Information not advice"; no AI solicitor wording; partnership agreements reviewed | Legal SME |
| L-03 | Inadequate privacy notice for document uploads | 2 | 2 | 4 | GDPR retention (Sprint 20); 24h expiry on uploads (Sprint 51); DPA with processors | DPO / Founder |
| L-04 | Discrimination or defamation in generated text | 1 | 3 | 3 | Policy gate; human approval queue; golden harness | Engineering |

---

## 2. Operational

| ID | Risk | L | I | Score | Mitigation | Owner |
|----|------|---|---|-------|------------|-------|
| O-01 | Government / legislation API format change stale Q&A cache | 2 | 2 | 4 | `effective_from` on modules; freshness model; re-ingestion runbook | Engineering |
| O-02 | Azure Document Intelligence outage blocks uploads | 2 | 2 | 4 | Async queue after 30s; manual review path; status page | Engineering |
| O-03 | Staging/prod host IP drift (K3s) blocks release | 2 | 2 | 4 | Host-truth reconciliation (G10); documented in `PRODUCTION_READINESS_GATE.json` | Infra |
| O-04 | Migration replay failure on deploy | 2 | 3 | 6 | Docker replay script (G09); down migrations 147–154 | Engineering |
| O-05 | Insufficient solicitor partners at launch | 2 | 3 | 6 | `docs/SOLICITOR_REFERRAL_PARTNERS.md` — 5-partner gate | Partnerships |

---

## 3. Competitive

| ID | Risk | L | I | Score | Mitigation | Owner |
|----|------|---|---|-------|------------|-------|
| C-01 | ChatGPT / Copilot "legal mode" free and good enough | 3 | 2 | 6 | Citation locking; UK-specific corpus; case timeline + doc upload; union distribution | Product |
| C-02 | Incumbent law firm apps add AI triage | 2 | 2 | 4 | Speed to market; union channel; referral network | Founder |
| C-03 | Race to bottom on pricing | 2 | 2 | 4 | Value = citations + deadlines + escalation pack, not chat alone | Product |

---

## 4. Compliance and security

| ID | Risk | L | I | Score | Mitigation | Owner |
|----|------|---|---|-------|------------|-------|
| S-01 | ICO complaint / GDPR breach (document leak) | 1 | 3 | 3 | RLS; workspace isolation; pen test Gate 3; breach runbook | Security |
| S-02 | Cross-tenant data access (IDOR) | 2 | 3 | 6 | RLS tests C.1–C.5; pen test scope §4.2 | Engineering |
| S-03 | Payment PCI scope creep | 1 | 2 | 2 | Stripe Checkout only; no PAN storage | Engineering |
| S-04 | Secrets committed to repo | 1 | 3 | 3 | SealedSecrets; G16 gate; pre-commit scan | Engineering |
| S-05 | Pen test finds critical vuln at launch | 2 | 3 | 6 | Early scope to tester; staging-only; retest window | Security |

---

## 5. Technical / delivery

| ID | Risk | L | I | Score | Mitigation | Owner |
|----|------|---|---|-------|------------|-------|
| T-01 | Sprints 51–58 slip past launch window | 2 | 2 | 4 | Prep branch `dac26c9`; clarifications doc; per-sprint branches | Engineering |
| T-02 | pgvector index poor recall at scale | 2 | 2 | 4 | IVFFlat tuning; legal significance ranking; benchmark in Sprint 58 | Engineering |
| T-03 | Embedding cost overrun | 2 | 2 | 4 | Batch embed; cache; chunk size 200–500 tokens | Engineering |
| T-04 | UAT delay blocks merge | 3 | 2 | 6 | Parallel gate docs (this batch); prep on `feature/sprints-51-58-prep` | Product |

---

## 6. Top risks (score ≥ 6)

| ID | Risk | Action this fortnight |
|----|------|---------------------|
| L-01 | Wrong answer → lost claim | Accelerate 200 Q&A solicitor review (`LEGAL_CONTENT_AUDIT.md`) |
| L-02 | SRA characterisation | Legal review of all public copy + referral terms |
| O-04 | Migration failure | Run G09 Docker replay when daemon available |
| O-05 | No solicitor partners | Begin outreach — 5 firms (`SOLICITOR_REFERRAL_PARTNERS.md`) |
| C-01 | Big Tech legal chat | Ship citation + document band as differentiator |
| S-02 | Cross-tenant leak | Schedule pen test; RLS regression in CI |
| S-05 | Critical pen finding | Book tester with `PENETRATION_TEST_SCOPE.md` |
| T-04 | UAT delay | Stakeholder UAT sign-off tracker |

---

## 7. Acceptance / escalation

| Score | Action |
|-------|--------|
| 7–9 | Founder + weekly review; block launch if unresolved |
| 4–6 | Mitigation owner + fortnightly review |
| 1–3 | Monitor |

**Escalation contact:** _[founder email]_

---

## 8. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial register | Engineering |
