# IterLaw AI Governance Index

**Status:** Active governance documentation.
**Last Updated:** May 2026

---

## Purpose

This index lists all AI governance, AIA operating, and safety documentation for IterLaw. Use this as your entry point to understand how the AI system is governed and how AIAs coordinate.

---

## Core Governance Documents

### 1. AIA Operating Model

**File:** `docs/iterlaw/project/11-ai-governance/AIA_OPERATING_MODEL.md`

**What it covers:**
- Definition of each specialist AIA (Docs, QA, DB/RAG, Security, Infra, Superior AI Architect)
- Authority boundaries and restrictions for each AIA
- Coordination rules between AIAs
- Evidence requirements
- Handoff format
- Veto rights
- Sprint completion criteria

**When to read:** First introduction to how AIAs work together.

---

### 2. Documentation Truth Protocol

**File:** `docs/iterlaw/project/11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md`

**What it covers:**
- Rules for claiming implementation, staging, production readiness
- Evidence requirements for every status claim
- Test pass, deployment, and seeding rules
- Bad examples vs. good examples
- Claim audit checklist
- How false claims are prevented

**When to read:** Before marking any sprint as complete or any feature as ready.

---

### 3. Naming Consistency Policy

**File:** `docs/iterlaw/project/11-ai-governance/NAMING_CONSISTENCY_POLICY.md`

**What it covers:**
- Active product names: IterLaw, OrdinoxAI
- Deprecated names: RightsNow (never use in active docs)
- Canonical Kubernetes namespaces: iterlaw-{ai,rag,api,monitoring,security}
- File naming conventions
- Environment variable prefixes
- How to handle naming changes via ADR
- Consistency audit checklist

**When to read:** Before writing any documentation, creating config files, or naming new code.

---

### 4. Superior AI Architect AIA Specification

**File:** `docs/iterlaw/project/11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA.md`

**What it covers:**
- AI architecture design authority
- RAG, GraphRAG, Self-RAG strategy
- Local LLM routing policy (forbidden: external LLM calls in answer path)
- WASM deterministic gates
- Prompt governance rules
- Hallucination control
- Model selection and routing
- 15-item architecture review checklist
- AI system design template

**When to read:** Before designing, reviewing, or changing any AI component.

---

## Sprint and Project Status

### 5. Sprint Index

**File:** `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`

**What it covers:**
- Status of all sprints (1–9 complete, 10 pending, 11 planned)
- Key deliverables per sprint
- Evidence of completion
- Blockers and risks
- Remaining work

**When to read:** To understand overall project progress and current blockers.

---

### 6. Project Status

**File:** `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`

**What it covers:**
- Overall project health
- Governance docs added
- Sprints completed and pending
- Current blockers
- Remaining sprints
- Production readiness status

**When to read:** For executive summary of where IterLaw stands.

---

## How To Use This Index

### I'm a new AIA. Where do I start?

1. Read **AIA Operating Model** to understand your role and how you fit
2. Read **Documentation Truth Protocol** to understand what "done" means
3. Read **Naming Consistency Policy** so you don't introduce naming debt
4. Read the **Sprint Index** to see current status
5. If your role involves AI: read **Superior AI Architect AIA Specification**

### I need to mark something complete. What's required?

1. Check **Documentation Truth Protocol** for your type of claim
2. Find the evidence checklist (tests, deployment, monitoring)
3. Gather all evidence and point to file paths/command output
4. Update status in appropriate sprint doc
5. Reference the truth protocol in your handoff

### I'm designing a new AI feature. What's required?

1. Read **Superior AI Architect AIA Specification**
2. Use the **AI System Design Output** template
3. Get approval from Superior AI Architect AIA
4. Follow the **AI Architecture Review Checklist**
5. Document in ADR if it changes policy

### I found a naming violation. What do I do?

1. Document it in **ITERLAW_PROJECT_STATUS.md** under "Naming Debt"
2. Read **Naming Consistency Policy** to understand the fix
3. Plan fix for this sprint or next
4. Run consistency audit before sprint close

### I need to deploy something. What gates must pass?

1. Read **Documentation Truth Protocol** section 3: "Production Readiness"
2. Gather all 10 evidence items
3. Get written approval from all AIAs (section 5, AIA Operating Model)
4. Create operator runbook
5. Only then hand off to operator

---

## Quick Reference: Status Vocabulary

| Status | Meaning | Next Step |
|---|---|---|
| PLANNED | Documented but not started | Start work; move to IN_PROGRESS |
| IN PROGRESS | Actively being worked on | Continue; update docs daily |
| PENDING OPERATOR | Needs human action to proceed | Identify action; communicate deadline |
| PASS | Complete and verified | Mark done; move to next work |
| PARTIAL | Some aspects done, others not | List what's done; blockers; timeline |
| BLOCKED | Cannot proceed; external blocker | Root cause; owner; resolution deadline |

---

## Quick Reference: Evidence Checklist

| Claim | Evidence Required |
|---|---|
| "Code complete" | git log, git diff, test output |
| "Tests pass" | test command output, JSON report, test names |
| "Deployed to staging" | kubectl output, pod logs, curl health check |
| "Database seeded" | SELECT count output, migration log, index check |
| "Production ready" | All 10 gates pass (see Documentation Truth Protocol) |

---

## Key Decision: External LLMs Forbidden in Answer Path

**Policy:** Do not call external LLMs (Anthropic API, OpenAI, Gemini, etc.) in the critical path of legal answer generation.

**Allowed:**
- ✅ Local Ollama models
- ✅ RAG retrieval from trusted sources
- ✅ WASM deterministic gates
- ✅ Synthetic scenario generation for testing

**Forbidden:**
- ❌ External API calls in question → answer pipeline
- ❌ Real-time Anthropic/OpenAI calls for user questions
- ❌ Bypassing RAG to use model memory for legal facts

**Rationale:**
- External calls add latency
- External providers may be down
- External models may hallucinate
- Local models ensure privacy
- WASM gates ensure deterministic checks

Read: **SUPERIOR_AI_ARCHITECT_AIA.md** section "Local LLM Strategy"

---

## Key Decision: Offline-First Legal Database

**Policy:** All legal sources (GOV.UK, legislation.gov.uk, cases, ACAS guidance) must be ingested into local PostgreSQL + pgvector before user questions are answered.

**Allowed:**
- ✅ Pre-ingested legal source corpus
- ✅ Offline semantic search via pgvector
- ✅ Citation from local DB

**Forbidden:**
- ❌ Live API calls to gov.uk for every question
- ❌ Treating user documents as legal authority
- ❌ Answering from external sources not in local DB

**Rationale:**
- Speed: local DB is faster than API
- Reliability: no dependency on gov.uk uptime
- Auditability: all answers traced to ingested sources
- Consistency: same sources for all users

Read: **DB/RAG AIA section** in AIA Operating Model

---

## Contacts and Escalation

If you have questions about:

- **Sprint status or blockers:** Docs AIA
- **Test requirements or evidence:** QA AIA
- **Schema, migrations, or RAG:** DB/RAG AIA
- **Secrets, RBAC, or compliance:** Security AIA
- **Deployment or k8s:** Infra AIA
- **AI architecture or LLM routing:** Superior AI Architect AIA

---

## Document Maintenance

This index is maintained by the **Docs AIA** and updated whenever:
- New governance documents are added
- Sprint status changes
- Major blocker is resolved
- New ADR is adopted

Last updated: **May 2026**
Next review: **Sprint 12 completion**

---

*IterLaw AI Governance Index — May 2026 — Docs AIA*
