# IterLaw Agent Factory Sprint Plan (IA Track)

**Status:** Planning. **No IA sprint has started.**
**Track id:** `IA` (parallel to the main IterLaw delivery sprints).
**Scope:** Stand up a safe, governed AI-agent operating model for IterLaw — agents help build/test/secure/document/operate IterLaw without ever becoming the legal authority.
**Authority bound by:** [`../11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md`](../11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md), [`../../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md`](../../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md), [`../../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md`](../../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md), and CLAUDE.md control rules.
**Last updated:** 2026-05-13.

---

## Tooling direction (documentation-only; **nothing installed yet**)

- LangGraph — controlled workflow / state engine.
- CrewAI — AI team layer (role-scoped agents).
- n8n / Dify — optional external workflow / client automation.
- Haystack + pgvector — RAG pipeline improvements (on top of IterLaw's existing hybrid pipeline).
- OpenHands / Claude Code / Cursor — coding automation.
- Ollama / local models — local inference.
- WASM — policy / safety / risk gate.
- PostgreSQL — core legal / user / case / RAG database.
- K3s — hosting.

> Strict rule: **Do not install** LangGraph, CrewAI, Dify, n8n, Haystack, or OpenHands as part of this plan. Installation requires a separate sprint with its own acceptance gates.

---

## Status legend

- **NOT STARTED** (default)
- **PLANNING** — design under review
- **IN PROGRESS** — code on a branch, no human sign-off yet
- **PASS FOR FOUNDATION ONLY** — code-prepared, not wired to production
- **PASS** — QA evidence captured and human approval recorded
- **BLOCKED** — gate failed; reason captured

No IA sprint may move past planning without QA evidence and explicit human sign-off. No IA sprint may declare PASS without real captured test output and a real git diff (CLAUDE.md §3, §5).

---

## Sprint IA-1 — Agent operating model docs

- **Objective:** Land the operating model, governance rules, security boundaries, before/after architecture, and sprint index entry. Set the contract every later IA sprint inherits.
- **Files to change:**
  - `docs/iterlaw/architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md`
  - `docs/iterlaw/architecture/ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md`
  - `docs/iterlaw/project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md`
  - `docs/iterlaw/security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md`
  - `docs/iterlaw/project/07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md`
  - `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` (IA-track section)
- **Acceptance gates:** Docs exist, naming policy preserved, no RightsNow regressions, no false PASS claims, citation/zero-citation gates explicitly preserved.
- **Tests:** Doc-only sprint; gate checks are `grep` scans listed in the QA report section below.
- **Rollback notes:** Revert the doc files; no runtime impact.
- **Evidence required:** `git status`, `git diff -- docs/iterlaw`, gate `grep` outputs, QA report.
- **Status:** NOT STARTED.

## Sprint IA-2 — Agent registry and role definitions

- **Objective:** Stand up an agent-registry data model (role id, scope, allowed tools, hard boundaries, owner). Read-only first.
- **Files to change:**
  - `docs/iterlaw/architecture/ITERLAW_AGENT_REGISTRY_SCHEMA.md` (new)
  - `apps/legal-orchestrator/src/agents/registry.types.ts` (new — types only)
- **Acceptance gates:** Registry covers all 12 roles from the operating model. Types are pure (no runtime side-effects). No DB writes yet.
- **Tests:** Type-only unit tests; serialisation round-trip; reason-code coverage.
- **Rollback notes:** Pure types; remove files.
- **Evidence required:** typecheck + test output captured.
- **Status:** NOT STARTED.

## Sprint IA-3 — Task queue and evidence model

- **Objective:** Define the task envelope (request id, role, scope, inputs, gates passed, evidence pointers, audit hash). Mock-safe only.
- **Files to change:**
  - `docs/iterlaw/architecture/ITERLAW_AGENT_TASK_QUEUE_MODEL.md` (new)
  - `apps/legal-orchestrator/src/agents/task.types.ts` (new)
- **Acceptance gates:** Every task envelope carries reason codes + evidence pointer. No secrets in envelope. Append-only audit hash design documented.
- **Tests:** Schema tests, audit-hash determinism tests.
- **Rollback notes:** Pure types; remove files.
- **Evidence required:** typecheck + test output captured.
- **Status:** NOT STARTED.

## Sprint IA-4 — LangGraph workflow prototype

- **Objective:** Prototype a single LangGraph workflow on a branch in a sandbox project. Demonstrate state transitions for a code-review task. No production wiring.
- **Files to change:** Sandbox-only directory (e.g. `sandbox/agents/langgraph/`), not the production app path.
- **Acceptance gates:** Workflow demonstrably honours the policy gate stub. No external LLM calls. No production-DB calls.
- **Tests:** Workflow unit tests, gate-refusal tests, deterministic-replay test.
- **Rollback notes:** Delete sandbox directory.
- **Evidence required:** sandbox test output captured.
- **Status:** NOT STARTED.

## Sprint IA-5 — CrewAI sandbox team prototype

- **Objective:** Sandbox a CrewAI team (PM Agent + Backend Agent + QA Agent) on a sample task. Mock LLMs only.
- **Files to change:** Sandbox-only directory.
- **Acceptance gates:** Team produces a final artefact + decision trace + evidence pointer. No production code touched.
- **Tests:** End-to-end sandbox test with mocked LLMs.
- **Rollback notes:** Delete sandbox directory.
- **Evidence required:** sandbox test output captured.
- **Status:** NOT STARTED.

## Sprint IA-6 — RAG/Ingestion agent design

- **Objective:** Design (no code execution) the RAG/Ingestion agent: source provenance, effective dates, citation registry, refusal rules, dry-run mode.
- **Files to change:**
  - `docs/iterlaw/architecture/ITERLAW_RAG_INGESTION_AGENT_DESIGN.md` (new)
- **Acceptance gates:** Design respects existing hybrid + trust + freshness contract. No new external network calls. Dry-run-first.
- **Tests:** Design-only; doc gate checks.
- **Rollback notes:** Revert doc.
- **Evidence required:** doc diff captured.
- **Status:** NOT STARTED.

## Sprint IA-7 — QA/Audit agent implementation

- **Objective:** Build the first real, but read-only, QA/Audit agent. It reads git diffs, runs the existing test suite, and produces a PASS/PARTIAL/FAIL report — nothing else.
- **Files to change:**
  - `apps/legal-orchestrator/src/agents/qa/qaAgent.ts` (new — read-only)
  - tests under `apps/legal-orchestrator/src/tests/`
- **Acceptance gates:** Read-only on repo. No diff edits. Captures exact command output. Never marks PASS without proof.
- **Tests:** Unit tests for report generator; replay test against a sample diff.
- **Rollback notes:** Remove agent files; tests still pass.
- **Evidence required:** typecheck + test output captured, sample report attached.
- **Status:** NOT STARTED.

## Sprint IA-8 — Security agent discovery-only checks

- **Objective:** Discovery-only security agent: secret scan, auth/RLS check, exposed-port scan against a local sandbox, tool-permission audit. **No mutation.**
- **Files to change:**
  - `apps/legal-orchestrator/src/agents/security/discovery.ts` (new — read-only)
  - tests
- **Acceptance gates:** Cannot mutate firewall / SSH / K3s. Cannot close ports. Reports findings with reason codes; unknown ports are `UNKNOWN_DO_NOT_TOUCH`.
- **Tests:** Unit tests for scanners with fixture inputs; refuses to mutate when asked.
- **Rollback notes:** Remove files.
- **Evidence required:** test output captured + sample discovery report.
- **Status:** NOT STARTED.

## Sprint IA-9 — Marketing / documentation agent sandbox

- **Objective:** Sandbox a marketing + documentation agent that drafts copy and ADR / sprint docs. Drafts only; human approves.
- **Files to change:** Sandbox-only directory.
- **Acceptance gates:** No legal claims without approval; no auto-publishing; honest about non-deterministic content.
- **Tests:** Sandbox tests with mocked LLMs.
- **Rollback notes:** Delete sandbox directory.
- **Evidence required:** sandbox test output captured.
- **Status:** NOT STARTED.

## Sprint IA-10 — DevOps agent read-only K3s checks

- **Objective:** Read-only K3s inspection (nodes, pods, services, ingress, PVCs, backup readiness). No mutation.
- **Files to change:**
  - `apps/legal-orchestrator/src/agents/devops/readOnlyK3s.ts` (new — read-only)
- **Acceptance gates:** Cannot run `kubectl delete`, `helm uninstall`, `terraform destroy`. Cannot apply manifests. Discovery only. Production cluster requires explicit human read-credential.
- **Tests:** Unit tests with fixture cluster output; refuses mutation calls.
- **Rollback notes:** Remove files.
- **Evidence required:** test output captured + sample read-only report.
- **Status:** NOT STARTED.

## Sprint IA-11 — Approval gate and risk classifier

- **Objective:** Implement the cross-agent approval gate (deterministic), plus a risk classifier that flags high-risk actions (legal-tinted output, security-sensitive operations, schema changes, deploys).
- **Files to change:**
  - `apps/legal-orchestrator/src/agents/gate/approvalGate.ts` (new)
  - `apps/legal-orchestrator/src/agents/gate/riskClassifier.ts` (new)
  - tests
- **Acceptance gates:** Gate is deterministic. High-risk actions always require human approval. Reason codes always present.
- **Tests:** Truth-table tests for gate verdicts; reason-code coverage.
- **Rollback notes:** Remove files; existing tests must still pass.
- **Evidence required:** typecheck + test output captured.
- **Status:** NOT STARTED.

## Sprint IA-12 — Agent dashboard / admin UI

- **Objective:** Admin UI surface to view agent runs, evidence, reason codes, and approval state. Read-only first.
- **Files to change:** `apps/web/...` admin pages (new), API endpoints (read-only).
- **Acceptance gates:** No agent action triggerable from UI without human approval. No raw prompts shown in audit envelope. No secret leakage.
- **Tests:** UI + API tests against mock data.
- **Rollback notes:** Feature-flag off; default disabled.
- **Evidence required:** test output captured + UI screenshots.
- **Status:** NOT STARTED.

## Sprint IA-13 — Integration with OrdinoxAI management layer

- **Objective:** Define how OrdinoxAI manages agents across IterLaw and future products without weakening IterLaw safety.
- **Files to change:**
  - `docs/iterlaw/architecture/ITERLAW_ORDINOXAI_AGENT_INTEGRATION.md` (new)
- **Acceptance gates:** IterLaw legal-safety contract remains binding even when OrdinoxAI manages the pool. No cross-product secret leakage. Audit logs remain per-product.
- **Tests:** Design-only.
- **Rollback notes:** Revert doc.
- **Evidence required:** doc diff captured.
- **Status:** NOT STARTED.

## Sprint IA-14 — Production readiness review

- **Objective:** End-to-end readiness review of the IA track: load test, failure modes, secret-scan, prompt-injection resilience, audit-log integrity, approval-gate coverage.
- **Files to change:** `reports/ITERLAW_IA_TRACK_PRODUCTION_READINESS_REVIEW.md` (new).
- **Acceptance gates:** Every IA-1..IA-13 evidence pointer attached. No outstanding HIGH-severity findings. Human sign-off recorded.
- **Tests:** Full regression suite green; specific IA-track tests green; secret scan clean; "no external LLM in orchestrator path" scan clean.
- **Rollback notes:** N/A (review, not code).
- **Evidence required:** captured test runs + scans + sign-off block.
- **Status:** NOT STARTED.

---

## Universal acceptance rules

- Status defaults to **NOT STARTED**. Promotion requires real evidence.
- No IA sprint may weaken `citation_required`, `zero_citation_answer_blocked`, `legal_review_queue`, trusted-source ranking, effective-date filtering, or the WASM/policy gate.
- No IA sprint adds an external LLM SDK to the orchestrator request path.
- No IA sprint touches production DB, production K3s, firewall, or SSH without an explicit operator sprint and human approval.
- Every IA sprint that touches code must show:
  - a real git diff,
  - typecheck PASS output,
  - build PASS output,
  - test PASS output,
  - a captured QA report under `reports/`.
- "PASS FOR FOUNDATION ONLY" is used for code-prepared sprints. PASS requires human sign-off.
- The deprecated name `RightsNow` must not appear in active docs / code added by any IA sprint.
