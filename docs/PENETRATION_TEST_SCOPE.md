# Penetration Test Scope (Gate 3)

**Product:** IterLaw  
**Status:** DRAFT — issue to pen tester before product Sprint 7  
**Gate:** PRD Section 16, Gate 3 — evidence required before launch  
**Environment:** **Staging only** — no production access  
**Last updated:** 2026-05-16

**Related:** `docs/iterlaw/project/05-security/RLS_SECURITY_MODEL.md`, `docs/infra/ITERLAW_SECRETS_RUNBOOK.md`

---

## 1. Executive summary

Third-party penetration test of IterLaw **staging** web and API surfaces, with focus on authentication, authorisation (RLS), document lifecycle, payments, and cross-tenant isolation.

| Outcome | Criteria |
|---------|----------|
| **Pass** | **0** critical findings; **≤ 2** high findings (with accepted remediation plan) |
| **Fail** | Any critical; or &gt; 2 high without remediation |

---

## 2. Scope — in

| # | Component | URL / endpoint (staging) | Notes |
|---|-----------|--------------------------|-------|
| 1 | Web application | `https://[staging-host]/` | SPA + server routes |
| 2 | Legal orchestrator API | `https://[staging-host]/api/*` | Includes health if exposed |
| 3 | Auth flows | Login, logout, session refresh, OAuth (Google/Apple if enabled) | JWT / cookie model |
| 4 | User & workspace APIs | Workspace CRUD, member roles | RLS enforcement |
| 5 | Case APIs | `legal_case_records` + child tables | Cross-user tests |
| 6 | Document upload | `POST /api/documents/upload` (when live) | MIME, size, authz |
| 7 | Answer / RAG API | Legal question + citation response | Injection, IDOR |
| 8 | Payment flow | Stripe Checkout / Customer Portal (test mode) | PCI scope limited to redirect |
| 9 | Mobile API clients | Same API via mobile user-agent | If staging build provided |
| 10 | Admin / operator routes | If exposed on staging | Must use test credentials only |

### 2.1 Test credentials (supplied out-of-band)

| Role | Purpose |
|------|---------|
| `user_a` | Standard user, workspace W1 |
| `user_b` | Standard user, workspace W2 (isolation) |
| `solicitor` | Role=solicitor, assigned cases only |
| `admin` | Workspace admin |
| `reviewer` | Read-only reviewer account |

---

## 3. Scope — out

| # | Item | Reason |
|---|------|--------|
| 1 | **Production** environment | Explicitly excluded |
| 2 | Azure / Hetzner infrastructure pentest | Separate infra assessment |
| 3 | Physical security | N/A |
| 4 | Social engineering of staff | Out of scope unless agreed |
| 5 | DDoS / load testing | Separate performance test |
| 6 | Third-party SaaS internals | Stripe, Azure OpenAI, Azure DI — only integration points |
| 7 | SealedSecrets / K8s control plane | Not exposed on staging ingress |
| 8 | Source code review | Optional separate SAST; not in this scope |

---

## 4. Threat model (focus areas)

### 4.1 JWT and session handling

| Threat | Test approach |
|--------|---------------|
| Token forgery / alg none | Manipulate JWT header/payload |
| Expired / revoked session reuse | Replay old tokens |
| Missing auth on protected routes | Unauthenticated access to `/api/*` |
| Insecure cookie flags | `HttpOnly`, `Secure`, `SameSite` |

### 4.2 RLS and case data isolation

| Threat | Test approach |
|--------|---------------|
| IDOR on `case_id` | User A accesses User B case UUID |
| Child table bypass | Access `legal_case_documents` without parent read |
| Solicitor overreach | Solicitor writes unassigned case |
| Workspace boundary | Member of W1 accesses W2 resources |

Reference: migration `106_enable_rls.sql` policies.

### 4.3 Document image / file lifecycle

| Threat | Test approach |
|--------|---------------|
| Unauthenticated download | Guess `storage_key` / signed URL |
| MIME bypass | Upload executable as PDF |
| Oversized upload | &gt; 10 MB denial of service |
| OCR text injection | Malicious content in extracted text → XSS in UI |
| Retention / expiry | Access document after `expires_at` (Sprint 51) |

### 4.4 Payment (PCI)

| Threat | Test approach |
|--------|---------------|
| Price manipulation | Tamper client-side amounts |
| Webhook forgery | Unsigned Stripe webhook posts |
| Test keys in prod | Verify staging uses `sk_test_*` only |

**Note:** Card data handled by Stripe — no PAN storage on IterLaw servers.

### 4.5 Injection and abuse

| Threat | Test approach |
|--------|---------------|
| SQL injection | Parameterised query bypass attempts |
| Prompt injection | Legal question API — exfiltration / policy bypass |
| SSRF | Any URL fetch in document/OCR pipeline |
| Rate limiting | Brute force login, upload flood |

---

## 5. Rules of engagement

| Rule | Detail |
|------|--------|
| **Environment** | Staging hostnames only (written list from IterLaw) |
| **IP allowlist** | Tester IPs registered before start |
| **Hours** | Business hours UK unless 24/7 agreed |
| **Destructive tests** | No data wipe; no ransomware simulation |
| **DoS** | Not permitted |
| **Finding disclosure** | Private report to [security@iterlaw.ai]; 90-day coordinated disclosure |
| **Evidence** | Screenshots + request/response; redact PII |
| **Retest** | One retest window within 14 days of fix deploy |

---

## 6. Deliverables

| Deliverable | Due |
|-------------|-----|
| Executive summary | Last day of test |
| Technical report (CVSS + repro steps) | +3 business days |
| Finding spreadsheet | With report |
| Retest confirmation | After fixes |

---

## 7. Success criteria (Gate 3)

| Severity | Allowed at launch |
|----------|-----------------|
| Critical | **0** |
| High | **≤ 2** (documented accept or fix) |
| Medium | Remediation plan |
| Low / Info | Best effort |

**Evidence file:** `reports/PENETRATION_TEST_[DATE].pdf` linked from production readiness gate.

---

## 8. Staging prerequisites (operator)

| # | Prerequisite | Owner |
|---|--------------|-------|
| 1 | Staging URL live + TLS valid | Infra |
| 2 | Test accounts provisioned | Engineering |
| 3 | Document upload enabled (or mock) | Engineering |
| 4 | Stripe test mode | Product |
| 5 | Application Insights logging on | Infra |
| 6 | Incident contact on-call | Operations |

---

## 9. Schedule (proposed)

| Phase | Duration |
|-------|----------|
| Kickoff + access | 1 day |
| Automated + manual test | 5 days |
| Report | 3 days |
| Fix sprint | 10 days |
| Retest | 2 days |

**Target start:** Before product Sprint 7 code freeze.
