# IterLaw Before / After Agent Architecture

**Status:** Architecture documentation only. No runtime is installed. No agents are running. Production readiness is **NOT** claimed.

Companion documents:

- Operating model: [`./ITERLAW_AI_AGENT_OPERATING_MODEL.md`](./ITERLAW_AI_AGENT_OPERATING_MODEL.md).
- Hard rules: [`../project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md`](../project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md).
- Security boundaries: [`../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md`](../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md).
- Sprint plan: [`../project/07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md`](../project/07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md).

---

## 1. Why this doc exists

To make the contrast between the current human-driven workflow and the proposed agent-assisted workflow explicit, so the reader can verify that the proposed model does **not**:

- become the legal authority,
- bypass safety gates,
- bypass `legal_review_queue`,
- weaken `citation_required` or `zero_citation_answer_blocked`,
- mutate production without human approval.

---

## 2. Before — today's reality

The human operator drives every step manually. Each tool is invoked by hand. Each result is reviewed by hand. There is no agent layer.

```
User / Khaled
    |
    v
ChatGPT / Claude / Cursor (invoked manually)
    |
    v
Manual code changes (hand-applied on a branch)
    |
    v
Manual tests (hand-run; output read by human)
    |
    v
Manual reports (hand-written under reports/)
    |
    v
Manual deploy checks (operator-driven)
    |
    v
Production decision (human)
```

Characteristics:

- High human attention required for every step.
- Trust comes from the human reading every diff and every test output.
- No structured task queue.
- No structured evidence record beyond the QA reports the operator writes.
- The legal answer pipeline (RAG + WASM gate + citation rules + `legal_review_queue`) is already trusted and remains untouched by this workflow.

---

## 3. After — proposed agent-assisted workflow

The human operator drives an **IterLaw agent control interface**. The interface fans tasks out to role-scoped agents through a controlled workflow (LangGraph) and a team layer (CrewAI), all bounded by the WASM policy gate and the QA / Audit Agent, with a **human approval step** before any merge or deploy.

```
Khaled / Admin
    |
    v
+---------------------------------+
| IterLaw agent control interface |
+---------------------------------+
    |
    v
+----------------------------+
| Policy / WASM gate         |   <-- deterministic; enforces legal-safety contract
+----------------------------+
    |
    v
+----------------------------+
| Agent registry             |   <-- role-bound agents (PM, Architecture, Backend,
+----------------------------+       Frontend, RAG/Ingestion, Legal Safety, QA/Audit,
    |                                Security, DevOps, Marketing, Documentation,
    |                                Support)
    v
+----------------------------+
| LangGraph workflow         |   <-- routes the task; state machine; replayable
+----------------------------+
    |
    v
+----------------------------+
| CrewAI role team           |   <-- composes role agents for the task
+----------------------------+
    |
    v
+----------------------------+
| Task queue                 |   <-- envelope: role, inputs, permissions, status,
+----------------------------+       evidence pointer
    |
    v
+----------------------------+
| Tools with scoped perms    |   <-- read-only first; mutating tools require gate
+----------------------------+       + human approval
    |
    v
+----------------------------+
| QA / Audit Agent           |   <-- runs project tests; compares claimed diff vs
+----------------------------+       real diff; emits PASS / PARTIAL / FAIL with
    |                                exact command output
    v
+----------------------------+
| Human approval             |   <-- operator (Khaled / Admin) approves or rejects
+----------------------------+
    |
    v
+----------------------------+
| Merge / deploy / report    |   <-- merge to master, deploy via existing runbooks,
+----------------------------+       evidence record finalised
```

Characteristics:

- Every action is scoped to a role with explicit tool permissions.
- Every action produces an evidence record (append-only).
- Every risky action is blocked by the WASM gate unless explicitly allowed.
- Every change is verified by the QA / Audit Agent before human approval.
- Every merge / deploy requires a human approver.
- The **legal answer path** is unchanged — RAG + WASM gate + citation rules + `legal_review_queue` remain authoritative. The agent layer sits **outside** the user-facing legal request path.

---

## 4. What stays the same

- The legal authority: trusted legal sources, RAG provenance, deterministic rules, WASM safety gate, human legal review.
- `citation_required = true` for legal answers.
- `zero_citation_answer_blocked = true` for legal answers.
- `legal_review_queue` for uncertain / high-risk / weak-citation answers.
- Effective-date filtering on retrieved material.
- Trusted-source-only retrieval ranking.
- The orchestrator request path remains free of external LLM calls.
- The Sprint 10–15 evidence model and the SPRINT_INDEX truth protocol.

---

## 5. What changes

- A new **control interface** for the operator (admin UI, later sprint).
- A new **agent registry** describing roles, permissions, and hard boundaries.
- A new **task queue** carrying inputs, permissions, status, and evidence pointers.
- A new **evidence record** schema, append-only.
- A new **deterministic approval gate** + **risk classifier** ahead of human approval.
- New **read-only checks** for security and DevOps.
- A defined **branch + PR + human-approval** flow for every code change an agent proposes.

None of these changes weaken any legal-safety gate. None of these changes mutate production without human approval.

---

## 6. What does not change for end users

End users continue to interact with IterLaw through the existing legal-answer surface. The agent layer is internal: it accelerates engineering, QA, security, marketing, documentation, RAG, and operations work. End-user legal answers continue to flow through the RAG + safety-gate + review-queue path defined by Sprints 1–15 and the Sprint 16+ roadmap.

---

## 7. Status

This document is documentation only. It does **not** install any agent runtime. It does **not** mutate the cluster, the firewall, SSH, or any port. It does **not** claim production readiness, hardening completion, or agent activation.
