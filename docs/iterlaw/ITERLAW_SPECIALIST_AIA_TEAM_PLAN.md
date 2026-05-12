# IterLaw Specialist AIA Team Plan

**Purpose:** Define the specialist AI-agent (AIA) workforce to accelerate IterLaw from Sprint 10 through go-live.

**Context (read first):** `ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md`, `reports/ITERLAW_QA_REPORT_SPRINT_10_READINESS.md`.

**Last updated:** 12 May 2026

**Cross-reference:** `ITERLAW_PROJECT_STATUS.md` groups some goals under adjacent sprint numbers (for example official ingestion vs local gateway). This plan uses the **sprint numbering and ownership table below** as the coordination contract; the Lead Solution Architect AIA reconciles any delta during sprint reviews.

---

## Why specialist AIAs

IterLaw spans UK employment law reliability, RAG schema correctness, Postgres and pgvector, K3s operations, security and UK GDPR, QA evidence discipline, product scope, UX for legal answers, and release gates. A single generalist agent context-switching across those concerns increases rework, schema drift, and unsafe operator actions (push, deploy, `kubectl apply`, production `psql`, secrets, external LLM calls).

**How this reduces time to go-live**

- **Parallel assurance:** Legal SME, Security, and QA can review the same sprint artifact stream without blocking implementation sequencing, as long as the Lead Architect sequences merges.
- **Single accountability per concern:** Each gate (citations, migrations, namespaces, secrets, tests, release) has a named owner and output template, reducing “who signed off?” ambiguity.
- **Evidence-first PASS:** QA and Release Manager AIAs enforce PASS only with command output and verifier logs, matching the readiness standard in `reports/ITERLAW_QA_REPORT_SPRINT_10_READINESS.md`.
- **Operator safety:** DevOps and DB AIAs keep destructive or cluster-touching work behind explicit human approval, avoiding recovery time lost to accidental applies.

---

## How many specialist AIAs

**Ten (10)** specialist AIA roles are required, listed below. They are **roles**, not headcount: one human or one automation profile may cover multiple roles in a small team, but each role’s outputs and gates still must exist before a sprint is marked PASS.

---

## Specialist AIA roles

### 1. Lead Solution Architect AIA

**Purpose:** Owns the full IterLaw architecture and sprint sequencing.

**Responsibilities**

- Keeps IterLaw naming consistent (IterLaw active; RightsNow legacy only per `ITERLAW_PROJECT_STATUS.md`).
- Controls architecture decisions and reconciles docs (for example `RAG_SCHEMA_CANONICAL_DECISION.md`, sprint plans vs status file).
- Ensures no duplicate namespaces or confused schema between `public.legal_*`, `uk_emp_rag.*`, and migration chains (`100_*` draft excluded from apply).
- Reviews every sprint before commit from an end-to-end coherence perspective.
- Decides whether work is **PASS / PARTIAL / FAIL** at the sprint summary level, incorporating specialist reports.

**Outputs**

- Sprint plan (sequencing, dependencies, exit criteria).
- Architecture decision notes (ADR-style).
- Risk register (shared; Security may contribute legal/GDPR rows).
- Go-live checklist (consolidated; Release Manager owns execution gates).

---

### 2. UK Employment Law SME AIA

**Purpose:** Acts as the legal-domain specialist for UK employment law.

**Responsibilities**

- Checks whether sources are legally reliable and appropriate for automated citation.
- Confirms UK employment-law categories and boundaries (not immigration, not consumer law, unless explicitly in scope).
- Reviews citations from GOV.UK, legislation.gov.uk, ACAS, tribunal and case-law sources (aligned with Sprint 10 seed list intent in `SPRINT_10_LIVE_RAG_PLAN.md`).
- Flags unsafe legal answer behaviour (overconfidence, missing limitations, missing jurisdictional facts).
- Ensures the assistant does not pretend to be a solicitor; reinforces disclaimers and “information not advice” patterns.

**Outputs**

- Legal source approval matrix (source, trust tier, refresh rules, caveats).
- Legal answer safety rules (blocked phrases, required disclaimers, escalation paths).
- Citation quality report (per sprint or per corpus batch).

---

### 3. RAG / Knowledge Engineer AIA

**Purpose:** Owns the legal corpus, chunking, embeddings, retrieval, and citation evidence.

**Responsibilities**

- Designs ingestion pipeline (fetch, normalise, chunk, cite, audit) with rate limits and allow-lists per project rules.
- Reviews `legal_documents`, `legal_chunks`, `legal_cases`, and domain-specific tables as used by retrieval; confirms writer–reader contract.
- Confirms temporal filtering (`effective_date`, `applicable_to`, `applicable_on` from facts) matches orchestrator behaviour.
- Confirms citations are returned correctly in the response envelope (chunk_id, document metadata, labels).
- Tunes retrieval quality (hybrid search, top-K, domain filters).
- Defines fallback when no source exists (`insufficient_sources`, `citation_failed`) and documents zero-citation blocking.

**Outputs**

- RAG test report (scenarios, expected statuses).
- Retrieval quality report (precision-oriented; regression baselines).
- Chunking rules (token targets, section-aware splits, overlap policy).
- Source freshness report (ingestion runs, stale sources).

---

### 4. Database Architect AIA

**Purpose:** Owns PostgreSQL, pgvector, migrations, backup safety, and DB integrity.

**Responsibilities**

- Reviews migration chain order and idempotency; blocks destructive SQL unless explicitly approved and documented.
- Checks pgvector readiness (`000_pgvector_prerequisite`, extension in live DB when operator verifies).
- Designs indexes (FTS, vector, FK paths) for retrieval and ingestion workloads.
- Reviews restore and checkpoint process (`FORCE_RESTORE`, production host guards per QA report).
- Confirms DB does not live only on local PC (staging path, backup, repeatable restore).

**Outputs**

- Migration audit (applied vs pending; `100_*` draft handling).
- DB readiness checklist (extensions, critical tables, smoke queries).
- Backup/restore verification (dry-run or staging drill as approved).
- Schema drift report (migrations vs live, reader SQL vs columns).

---

### 5. Kubernetes / DevOps AIA

**Purpose:** Owns K3s deployment readiness and cluster hygiene.

**Responsibilities**

- Reviews namespaces: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`, `iterlaw-data`.
- Reviews manifests, Ingress, Services, image names, resource limits; flags placeholder digests/tags (for example backup uploader per QA report).
- Confirms no `kubectl apply` unless explicitly approved by process.
- Confirms deployment order (data plane, secrets, app, monitoring).

**Outputs**

- K3s readiness report (manifest lint, policy, gaps).
- Deployment dry-run report (`kubectl apply --dry-run=server` only when approved).
- Namespace policy report (labels, NetworkPolicies, least privilege).

---

### 6. Security / Compliance AIA

**Purpose:** Owns secrets, UK GDPR, access control, audit logs, and legal-risk boundaries.

**Responsibilities**

- Runs secret scans and reviews findings (shape-based; no exfiltration of values).
- Reviews `.env` templates, sealed secrets templates, CI files, and deny-lists in verifiers.
- Checks no private keys, live DB URLs, or API keys are committed.
- Reviews auth and RBAC (future sprints: member, admin).
- Defines UK GDPR retention, consent controls, and audit log requirements.

**Outputs**

- Security QA report (per sprint).
- Secret scan report (method, counts, classification).
- GDPR checklist (lawful basis, retention, subject access, subprocessors as applicable).
- Risk register entries for security and compliance (feeds Lead Architect register).

---

### 7. QA / Test Engineer AIA

**Purpose:** Runs independent testing and challenges claims with evidence.

**Responsibilities**

- Runs typecheck, build, Vitest, and repo/infra verifiers (`verify-iterlaw-repo.sh`, `verify-iterlaw-rag-db.sh`, `verify-iterlaw-canonical-namespaces.sh`, backup verifier as relevant).
- Checks test quality (flaky tests, missing negative paths, temporal and citation cases).
- Creates regression tests for fixed defects and locked contracts (for example live RAG wiring tests).
- Confirms PASS only with evidence (command + result); tracks test counts across sprints.
- Flags CI gaps (for example orchestrator job not required on PR per QA report).

**Outputs**

- QA report (aligned with `reports/ITERLAW_QA_REPORT_SPRINT_10_READINESS.md` structure where useful).
- Failed-test triage (root cause bucket: code, test, env, data).
- Regression test list (must-not-break behaviours).
- Sprint sign-off table (sprint, status, evidence links or log excerpts).

---

### 8. Product Owner AIA

**Purpose:** Keeps the application aligned to the business goal and prevents endless technical churn.

**Responsibilities**

- Defines MVP scope and acceptance criteria in plain language.
- Separates **internal MVP** (trusted users, limited surface) from **public SaaS go-live** (auth, billing, abuse controls).
- Prioritises backlog items that unblock user value vs purely internal refactors.
- Prevents endless technical work without measurable product progress.
- Defines user journeys (question to answer, case workspace, admin/review).

**Outputs**

- MVP backlog (ordered, sized at high level).
- Go-live backlog (hard gates vs nice-to-have).
- User journey map (MVP vs later).
- Priority list per sprint (top 3 outcomes).

---

### 9. UX / Conversation Designer AIA

**Purpose:** Designs the ChatGPT-like user experience and safe presentation of legal information.

**Responsibilities**

- Designs user question flow (clarifications, missing facts).
- Designs “my cases” area (case list, timeline, documents).
- Designs missing-facts questions (employment dates, jurisdiction, procedure stage).
- Designs safe legal answer layout (citations prominent, limitations visible).
- Ensures the experience feels **professional** without the product **impersonating** a solicitor (tone and labels coordinated with Legal SME).

**Outputs**

- UI/UX flow diagrams or structured outlines.
- Answer templates (deterministic and LLM-assisted phases when allowed).
- Missing-facts templates (copy-deck style).
- Case journey design (onboarding through resolution or handoff).

---

### 10. CI/CD Release Manager AIA

**Purpose:** Controls Git hosting workflow, release flow, and deployment gates.

**Responsibilities**

- Checks branch state (ahead/behind remote, clean tree before push recommendations).
- Prevents accidental push with dirty tree or unreviewed secret-scan outcomes.
- Reviews GitHub Actions (active vs disabled workflows; doc drift vs `workflows-disabled/`).
- Defines release process (PR, required checks, tag, changelog).
- Confirms when safe to push or deploy (human operator executes; AIA only recommends).

**Outputs**

- Release checklist (pre-merge, pre-tag, pre-deploy).
- CI/CD gate report (required checks, coverage of legal-orchestrator).
- Push readiness report (commits, drift, review status).
- Rollback plan (image pin, DB migration rollback notes, feature flags if any).

---

## Sprint ownership (Sprint 10–19)

| Sprint | Theme | Lead AIA | Supporting AIAs |
|--------|--------|----------|-----------------|
| **10** | Live RAG | RAG / Knowledge Engineer | Database Architect, QA / Test Engineer, Security / Compliance |
| **11** | Local LLM gateway | Lead Solution Architect | RAG / Knowledge Engineer, Security / Compliance, QA / Test Engineer |
| **12** | Backup / restore / DB checkpoint go-live | Database Architect | Kubernetes / DevOps, Security / Compliance, QA / Test Engineer |
| **13** | Internal MVP polish | Product Owner | UX / Conversation Designer, QA / Test Engineer, Lead Solution Architect |
| **14** | Member / auth / subscription | Security / Compliance | Product Owner, Kubernetes / DevOps, QA / Test Engineer |
| **15** | Admin / legal review UI | UX / Conversation Designer | UK Employment Law SME, Product Owner, QA / Test Engineer |
| **16** | AIA layer | Lead Solution Architect | All specialist AIAs (as needed per workstream) |
| **17** | UK GDPR / retention / audit | Security / Compliance | Database Architect, UK Employment Law SME, QA / Test Engineer |
| **18** | Production hardening | Kubernetes / DevOps | Security / Compliance, CI/CD Release Manager, QA / Test Engineer |
| **19** | Public launch | CI/CD Release Manager | Product Owner, Lead Solution Architect, Security / Compliance, QA / Test Engineer |

### Lead ownership by sprint (quick lookup)

| Sprint | Lead |
|--------|------|
| 10 | RAG / Knowledge Engineer |
| 11 | Lead Solution Architect |
| 12 | Database Architect |
| 13 | Product Owner |
| 14 | Security / Compliance |
| 15 | UX / Conversation Designer |
| 16 | Lead Solution Architect |
| 17 | Security / Compliance |
| 18 | Kubernetes / DevOps |
| 19 | CI/CD Release Manager |

### Which sprints each role **leads**

| Role | Leads (primary) |
|------|-----------------|
| Lead Solution Architect | 11, 16 |
| UK Employment Law SME | — (support: 15, 17; ongoing source review) |
| RAG / Knowledge Engineer | 10 |
| Database Architect | 12 |
| Kubernetes / DevOps | 18 |
| Security / Compliance | 14, 17 |
| QA / Test Engineer | — (support on all sprints; sign-off authority on evidence) |
| Product Owner | 13 |
| UX / Conversation Designer | 15 |
| CI/CD Release Manager | 19 |

---

## Operating rules (all AIAs)

- **No push, no deploy, no `kubectl apply`, no production `psql`, no secrets created, no external LLM calls** unless a human operator explicitly instructs and approvals are recorded.
- **IterLaw** is the active product name in runtime and config; **RightsNow** is legacy only.
- **PASS** at sprint level requires Lead Solution Architect AIA agreement **and** QA evidence for automated gates relevant to that sprint.
- Specialist reports use the template below for every formal sprint review.

---

## Reporting template (mandatory)

Each specialist AIA must report in this format:

```text
ROLE:
SPRINT:
STATUS: PASS / PARTIAL / FAIL

WHAT I CHECKED:
-

EVIDENCE:
- command:
- result:

RISKS:
-

BLOCKERS:
-

FILES CHANGED:
-

TESTS:
- typecheck:
- build:
- vitest:
- verifier:

RECOMMENDATION:
- proceed / stop / needs fix

CONFIRMATIONS:
- no push
- no deploy
- no kubectl apply
- no production psql
- no secrets created
- no external LLM called
```

---

## Summary for stakeholders

| Item | Value |
|------|--------|
| **Number of specialist AIAs** | **10** |
| **What each one does** | See sections 1–10 above (architecture, UK employment law, RAG, database, K3s, security/GDPR, QA evidence, product scope, UX, release gates). |
| **Which sprint each one owns** | See “Sprint ownership” and “Lead ownership by sprint” tables; each role also lists **support** assignments per sprint. |
| **Time to go-live impact** | Parallel specialist review, clear leads per sprint, evidence-based PASS, and operator-safety boundaries reduce rework and incident recovery cost. |

---

## Commit policy

**Do not commit this file until the product owner (human) approves.** Updates after approval should still go through PR review with Lead Solution Architect and QA sign-off on any sprint claims.
