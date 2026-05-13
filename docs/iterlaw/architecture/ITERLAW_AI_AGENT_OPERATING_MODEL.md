# IterLaw AI Agent Operating Model

**Status:** Draft governance / architecture specification.
**Track:** IterLaw Agent Factory (IA track).
**Authority:** IterLaw remains the legal product. OrdinoxAI is the wider AI management/platform brain. AI agents are helpers/workers — never the legal authority.
**Last updated:** 2026-05-13.

---

## 1. Purpose

This document defines how AI agents are allowed to help build, test, secure, market, document, monitor, and (later) manage IterLaw. It exists so we can scale internal work without ever bypassing IterLaw's legal-safety contract.

Agents accelerate engineering, ops, marketing, and documentation. They do **not**:

- answer legal questions to end users,
- override the citation gate (`citation_required`),
- override the zero-citation block (`zero_citation_answer_blocked`),
- override the legal review queue (`legal_review_queue`),
- bypass trusted-source-only retrieval,
- bypass effective-date / temporal filtering,
- bypass the WASM / deterministic policy gate,
- deploy, mutate K3s, mutate firewall, or expose ports.

The legal authority remains: trusted legal sources + RAG provenance + deterministic rules + WASM safety gate + human review.

---

## 2. Before / After architecture

See companion doc: [`ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md`](./ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md).

In short: today the human operator drives every code change, test run, and review manually through ChatGPT / Claude / Cursor. Going forward, the operator drives a controlled agent surface that fans tasks out to role-scoped agents, all of which are bounded by a policy/WASM gate, a QA/audit agent, and a human approval step before any merge or deploy.

---

## 3. Agent roles

Each role has scope, permitted tools, hard boundaries, and the artefacts it must produce. Every role inherits the global rules in [`../project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md`](../project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md).

### 3.1 Project Manager Agent
- **Scope:** sprint planning, task tracking, blocker detection, progress reports.
- **Outputs:** sprint plan drafts, task lists, status reports with evidence pointers.
- **Boundary:** may not change code, may not declare a sprint PASS — that is QA/Audit Agent's job with evidence.

### 3.2 Architecture Agent
- **Scope:** app architecture, DB design, K3s design (review only), naming consistency, ADR drafting.
- **Outputs:** ADR drafts, architecture diff notes, naming-policy lint output.
- **Boundary:** read-only on infra; cannot apply K3s manifests; cannot rename canonical namespaces (`iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`).

### 3.3 Backend Agent
- **Scope:** APIs, `legal-orchestrator`, RAG services, ingestion services, queue workers.
- **Outputs:** code changes on branches + tests + git diff evidence.
- **Boundary:** cannot call external LLMs from the orchestrator request path; cannot weaken legal gates; cannot edit migrations on production; PR-only.

### 3.4 Frontend Agent
- **Scope:** IterLaw UI — cases dashboard, legal question screen, subscription/module UI, admin review screens.
- **Outputs:** UI changes on branches, accessibility notes, screenshot diffs.
- **Boundary:** must surface citations and review states honestly; cannot hide or fake an `unverified` answer as a final answer; must respect the legal review queue states.

### 3.5 RAG / Ingestion Agent
- **Scope:** ingest trusted legal sources (statutory, GOV.UK, ACAS, tribunal), provenance + citation registry + effective dates.
- **Outputs:** ingestion plans, dry-run reports, citation-coverage stats.
- **Boundary:** never fabricates legal content; cannot bypass source-trust ranking; cannot mark a draft AI output as a trusted source; cannot delete corpus rows; cannot disable temporal filtering.

### 3.6 Legal Safety Agent
- **Scope:** verifies citation rules, answer gating, blocks unsupported legal advice, routes through the legal review queue.
- **Outputs:** safety-gate verdicts with reason codes (`citation_required`, `zero_citation_answer_blocked`, `stale_source`, `uncited_legal_claim`, etc.).
- **Boundary:** can refuse / route to review; can **never** approve a legal answer on its own — approval is a human action.

### 3.7 QA / Audit Agent
- **Scope:** runs tests, inspects git diffs, validates evidence, writes PASS / PARTIAL / FAIL reports.
- **Outputs:** QA reports under `reports/`, with exact commands + exact output captured.
- **Boundary:** cannot declare PASS without proof (real command output, real diff, real test result). Must follow the proof-first rule (CLAUDE.md §5) and the documentation truth protocol.

### 3.8 Security Agent
- **Scope:** secret scans, auth/RLS checks, prompt-injection risk checks, tool-permission audits, open-port discovery.
- **Outputs:** read-only findings, risk register entries, hardening proposals.
- **Boundary:** discovery only at first. Cannot mutate firewall, cannot block SSH, cannot close unknown ports, cannot rotate secrets without approval. Hardening is staged and approved (see `docs/iterlaw/security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md`).

### 3.9 DevOps Agent
- **Scope:** K3s manifests review, pod/service/ingress inspection, backup readiness, rollout planning.
- **Outputs:** read-only K3s reports, rollout proposals, backup-readiness summaries.
- **Boundary:** no production mutation without explicit human approval; no `kubectl delete`; no production-DB action; no helm uninstall.

### 3.10 Marketing Agent
- **Scope:** marketing copy, SEO pages, customer onboarding content, pricing / module copy.
- **Outputs:** draft copy in branches, SEO metadata proposals, customer-onboarding flows.
- **Boundary:** must not make legal claims without approval; must not imply IterLaw is a solicitor; must not promise outcomes; legal-tinted copy is routed through the Legal Safety Agent + human approval.

### 3.11 Documentation Agent
- **Scope:** sprint docs, architecture docs, ADRs, operator guides, naming consistency.
- **Outputs:** doc PRs, ADR drafts, sprint-index updates.
- **Boundary:** must not mark sprints DONE / production-ready without QA evidence; must follow the documentation truth protocol; must respect the canonical name (`IterLaw`, not the deprecated `RightsNow`).

### 3.12 Support Agent
- **Scope:** drafts support replies, triages customer issues, routes legal questions into the approved IterLaw answer flow.
- **Outputs:** support-reply drafts (human-reviewed), triage notes, escalation tickets.
- **Boundary:** never gives legal advice directly. Legal questions are sent through the IterLaw orchestrator + legal review queue + citation gate.

---

## 4. Safe boundaries (applies to every agent)

- Repo sandbox first. Branch + PR workflow only. Human approval before merge.
- No production secrets in prompts, in logs, or in commits.
- No external LLM calls from the orchestrator request path.
- No production-DB writes from agents.
- No `kubectl` mutating commands. Discovery-only K3s read access.
- No firewall / SSH mutation. Unknown ports are `UNKNOWN_DO_NOT_TOUCH`.
- All agent outputs include reason codes for auditability.

---

## 5. Legal safety restrictions (non-negotiable)

These rules are inherited by every agent and cannot be disabled by any agent action, prompt, or configuration:

- `citation_required = true` for legal answers.
- `zero_citation_answer_blocked = true` — no source ⇒ no answer.
- Trusted-source-only retrieval ranks primary legislation, official GOV.UK/ACAS guidance, and tribunal sources highest. Draft AI output cannot outrank an official source for a legal answer.
- Effective-date filtering — stale or superseded material is blocked from a fresh legal answer (allowed only when historical comparison is explicitly requested).
- `legal_review_queue` — uncertain, high-risk, or weak-citation answers route to human review.
- Deterministic legal calculations (statutory redundancy, notice periods, limitation dates, ACAS early-conciliation impact, SSP, holiday pay, NMW/NLW, unfair-dismissal cap, Vento bands) come from the deterministic rules engine, not from an LLM.
- WASM / policy gate verdicts are authoritative for permission, workspace isolation, approval, pricing, PII, tool permission, and agent-action checks.

If any agent proposes a change that would weaken any of the above, the proposal is rejected by policy regardless of test results.

---

## 6. How agents interact with RAG

- Agents may **propose** ingestion of new trusted legal sources (with provenance, effective dates, and citation metadata).
- Ingestion runs through the existing RAG pipeline (BM25 + pgvector + metadata + RRF + trust + freshness + compression) — agents do not invent retrieval shortcuts.
- Agents must call retrieval through the existing legal-orchestrator interface and respect the trust/freshness verdicts.
- Agents may not delete corpus rows. They may **flag** rows for human review.
- Source-trust ranking from `ITERLAW_RAG_TRUST_AND_FRESHNESS_MODEL.md` is authoritative.

## 7. How agents interact with code

- All changes via branch + PR; no direct pushes to `main` from agents.
- Every change must show a real git diff and pass existing tests.
- Agents must respect the canonical names (`iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`).
- No external LLM SDKs / network calls added to the orchestrator request path.
- No secrets in code, comments, or tests.

## 8. How agents interact with QA

- The QA / Audit Agent is the only role that produces PASS / PARTIAL / FAIL.
- Status claims must be backed by real command output (typecheck, build, tests), real diffs, and a captured report under `reports/`.
- No fake PASS. Real failure is acceptable; fake success is not (CLAUDE.md §3, §5).

## 9. How agents interact with security

- Security Agent runs discovery (secrets, auth/RLS, prompt-injection patterns, tool permissions, exposed-port scan).
- Discovery-only at first. Hardening is a separate, staged, approved phase.
- SSH and existing open ports of K3s / Traefik / cert-manager / Ollama / Postgres / Redis / NATS must be preserved unless explicitly approved for change.

## 10. How agents interact with marketing

- Marketing Agent drafts content; legal-tinted copy is reviewed by the Legal Safety Agent and a human.
- No outcome promises, no implicit "solicitor" framing, no auto-publishing.

## 11. How agents interact with operations

- DevOps Agent does read-only K3s inspection and backup-readiness checks.
- No production mutation without explicit human approval.
- Live backup / live restore remains gated by its own sprint and the operator authorisation checklist.

---

## 12. Approval workflow

```
Agent proposes change
   → Policy / WASM gate (deterministic check)
   → Legal Safety Agent (if legal-tinted)
   → QA / Audit Agent (tests + diff + report)
   → Human reviewer (approve / reject)
   → Merge / deploy (human-initiated)
```

Every step records reason codes and evidence pointers. The human reviewer can reject without justification; the agents cannot.

---

## 13. Audit and evidence requirements

Every agent run produces:

- A request id and a decision trace.
- The reason codes for every gate verdict.
- A pointer to the artefacts changed (git diff hash, branch).
- A pointer to the tests run and their exact output.
- An audit envelope that contains no DSN, no raw prompt body, no full answer body, no secrets.

Audit logs are append-only. Agents cannot delete or rewrite audit logs.

---

## 14. Forbidden actions (hard list)

Agents **must not**:

- Answer legal questions to end users directly.
- Modify legal source data without an audit record.
- Mark a legal answer approved.
- Delete audit logs.
- Bypass `legal_review_queue`.
- Disable `citation_required` or `zero_citation_answer_blocked`.
- Call external LLMs from the orchestrator request path.
- Deploy to production without human approval.
- Access secrets directly.
- Mutate firewall, SSH config, or K3s without discovery and approval.
- Use the deprecated name `RightsNow` / `rightsnow` in active documentation.

---

## 15. Relationship to OrdinoxAI

OrdinoxAI is the wider AI management / platform brain. It can later coordinate agents across multiple products. IterLaw remains the legal product. Even when OrdinoxAI manages the agent pool, the IterLaw safety contract in §5 is the binding rule for any agent touching IterLaw work.
