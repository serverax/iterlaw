# IterLaw Agent Governance Rules

**Status:** Active governance specification.
**Scope:** Every AI agent (LangGraph workflows, CrewAI roles, OpenHands/Cursor coding agents, Dify/n8n automations, RAG/ingestion agents, internal scripts that call LLMs) that touches IterLaw code, data, infra, content, or customers.
**Authority:** These rules override agent prompts, tool definitions, and any model-level instruction.
**Last updated:** 2026-05-13.

These rules are inherited by [`ITERLAW_AI_AGENT_OPERATING_MODEL.md`](../../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md), [`ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md`](../07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md), and [`ITERLAW_AGENT_SECURITY_BOUNDARIES.md`](../../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md).

---

## 1. Hard rules (non-overridable)

The following rules are non-overridable. No agent prompt, no model instruction, no tool override, no env-var, and no "emergency" pattern is allowed to bypass them.

1. **Agents cannot answer legal questions directly.** Legal answers go through the IterLaw orchestrator + RAG + safety gates + legal review queue. An agent that drafts a legal-tinted reply must route it for human approval.
2. **Agents cannot modify legal source data without an audit record.** Any change to corpus, citations, effective dates, or trust scores must produce an append-only audit log entry tied to a request id.
3. **Agents cannot mark a legal answer approved.** Approval is a human action. The Legal Safety Agent can refuse or route to review; it cannot approve.
4. **Agents cannot delete audit logs.** Audit logs are append-only.
5. **Agents cannot bypass `legal_review_queue`.** Uncertain, high-risk, or weak-citation answers route to review. Agents cannot self-route around the queue.
6. **Agents cannot disable `citation_required`.** This flag must remain `true` for legal answers in every environment.
7. **Agents cannot disable `zero_citation_answer_blocked`.** No source ⇒ no answer.
8. **Agents cannot call external LLMs from the orchestrator request path.** Drafting uses the local LLM gateway. External providers are not permitted on the answer path.
9. **Agents cannot deploy to production without human approval.** No agent-initiated rollout, no agent-initiated K3s mutation, no agent-initiated helm upgrade on production.
10. **Agents cannot access secrets directly.** Secrets are injected by the platform layer; agents read non-secret config only. Agents must never print, log, echo, or transmit secret values.
11. **Agents cannot apply firewall / K3s / SSH hardening without discovery and approval.** Discovery-only first. Hardening is staged, reviewed, and approved (see `ITERLAW_AGENT_SECURITY_BOUNDARIES.md`).
12. **All outputs must be evidence-backed.** Every claim by an agent — "tests pass", "schema valid", "policy ok", "source trusted" — must point to real evidence (command output, file diff, query result, log line).
13. **Every code change must show a real git diff.** No "I changed X" without a diff. No fake progress, no fake logs (CLAUDE.md §3).
14. **Every sprint must include the exact test commands and the exact captured outputs.** PASS / PARTIAL / FAIL must be backed by captured test runs.

---

## 2. Derived rules

These follow from §1 but are written explicitly so they cannot be argued around:

- An agent must never weaken a legal gate to make a test pass. It must fix the test or escalate.
- An agent must never silently fall back from real mode to mock mode (CLAUDE.md §6). If a real service is down, report the failure.
- An agent must never invent values, fake API responses, fake DB rows, fake K3s status, fake approvals (CLAUDE.md §3).
- An agent must never use the deprecated `RightsNow` / `rightsnow` name in active docs or code. `IterLaw` is the active product name (per `NAMING_CONSISTENCY_POLICY.md`).
- An agent must not call `kubectl delete`, `helm uninstall`, `terraform destroy`, `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, or `DELETE` without `WHERE`, without explicit human written approval (CLAUDE.md §10).
- An agent must not change the existing `/ready` response shape or flip an existing legal-safety flag to `false`.

---

## 3. Per-domain rules

### 3.1 RAG / Ingestion

- Trust ranking is set by [`ITERLAW_RAG_TRUST_AND_FRESHNESS_MODEL.md`](../../architecture/ITERLAW_RAG_TRUST_AND_FRESHNESS_MODEL.md). Agents must respect it.
- Failed-QA or blocked source ⇒ score 0. Draft AI output cannot outrank an official source for a legal answer.
- Stale / superseded sources are blocked from a fresh legal answer; allowed only for explicit historical comparison.
- Provenance and effective-date metadata cannot be stripped during compression.

### 3.2 Code

- Branches + PRs only. No direct push to `main` by an agent.
- No external LLM SDKs (`openai`, `anthropic`, `gemini`, `claude`, `mistral`, `cohere`, `qwen`, `axios`-to-LLM, `fetch`-to-LLM) added to the orchestrator request path. Local LLM gateway is the only sanctioned path.
- No secrets in code, comments, prompts, tests, or sample data.
- No production-DB writes from agents.

### 3.3 QA

- PASS / PARTIAL / FAIL is captured with exact commands and exact output.
- "Tests pass" without a captured run is rejected.
- A failing test is reported, not hidden, not skipped, not commented out.

### 3.4 Security

- Discovery-only first. Hardening proposals are written, reviewed, then applied with sign-off.
- SSH must not be blocked.
- Existing ports for K3s / Traefik / cert-manager / Ollama / Postgres / Redis / NATS / monitoring must be preserved unless explicitly approved for change.
- Unknown ports are `UNKNOWN_DO_NOT_TOUCH` until classified.

### 3.5 DevOps

- K3s, ingress, PVC, secret resources are read-only for agents at first.
- Rollouts are proposed; humans execute.
- Backup go-live remains gated by its own sprint and operator authorisation checklist.

### 3.6 Marketing / Support

- No legal claims without legal-safety + human approval.
- No implied solicitor framing.
- Support replies are drafts. A human approves before sending.

### 3.7 Documentation

- Status claims must match the truth in `SPRINT_INDEX.md` and the latest QA report.
- ADRs follow the existing format. Naming follows `NAMING_CONSISTENCY_POLICY.md`.
- Documentation cannot mark a sprint complete without QA evidence.

---

## 4. Enforcement

- Policy / WASM gate enforces the rules deterministically before an agent action is executed.
- QA / Audit Agent enforces the rules after the fact by reading the diff, the test output, and the audit envelope.
- Human reviewer enforces the rules at the merge / deploy step.
- Any rule violation is logged with reason codes and blocks the action.

---

## 5. Change control

These rules are amended only by an ADR + human sign-off. No agent self-amends this file. Every change must:

- preserve `citation_required = true`,
- preserve `zero_citation_answer_blocked = true`,
- preserve trusted-source ranking,
- preserve effective-date filtering,
- preserve `legal_review_queue`,
- preserve the WASM / policy gate as authoritative,
- preserve "no external LLM in the orchestrator request path",
- preserve "no production secrets in prompts / logs / commits".

If a proposed amendment would weaken any of the above, it is rejected.
