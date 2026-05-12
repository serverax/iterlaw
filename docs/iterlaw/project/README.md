# IterLaw — Project Documentation Index

> **AI agents:** start at [`00-index/AI_TOOL_START_HERE.md`](00-index/AI_TOOL_START_HERE.md). Only load the small file relevant to your task. Do not load every markdown file.

## At a glance

- **Product:** IterLaw — UK employment law AI assistant.
- **Platform / company brain:** OrdinoxAI.
- **Active product name:** **IterLaw**. Do **not** use `RightsNow` unless it is clearly inside legacy / disabled / archive material.
- **Default DB:** local / self-hosted PostgreSQL + pgvector. No public-cloud DB dependency.
- **External LLM in answer path:** disabled by default.

## Current status (high level)

- Sprints 1–9: completed (see [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md)).
- Sprint 10 DB foundation: **architecture-approved, committed at migrations 104/105/106** (skips 103 — reserved for future GraphRAG). Staging-DB verification: pending. Production: **BLOCKED**.
- Sprint 11 local LLM gateway: interface-only landed; benchmark pending.
- Branch state: local-only ahead of `origin/master`; no push performed by AI agents.

## Canonical names + namespaces

See [`00-index/CANONICAL_NAMES.md`](00-index/CANONICAL_NAMES.md) for the full list. Quick reference:

- `iterlaw-ai`
- `iterlaw-rag`
- `iterlaw-api`
- `iterlaw-monitoring`
- `iterlaw-security`

Legacy `iterlaw-data` may remain. **Do not** create a bare `iterlaw` or `iterlaw-prod` namespace.

## Documentation map

### Index / governance

- [`00-index/AI_TOOL_START_HERE.md`](00-index/AI_TOOL_START_HERE.md) — entry point for Claude Code / Cursor / other AI agents.
- [`00-index/CANONICAL_NAMES.md`](00-index/CANONICAL_NAMES.md) — names, namespaces, forbidden tokens.

### Domain summaries

- [`01-architecture/ARCHITECTURE_SUMMARY.md`](01-architecture/ARCHITECTURE_SUMMARY.md) — request flow, refusal paths, no-hallucination rule.
- [`02-database/DATABASE_SUMMARY.md`](02-database/DATABASE_SUMMARY.md) — Postgres + pgvector + Sprint 10 user-case workspace tables.
- [`03-rag/RAG_SUMMARY.md`](03-rag/RAG_SUMMARY.md) — trusted UK sources + citation contract.
- [`04-ai-llm/LOCAL_LLM_AND_WASM.md`](04-ai-llm/LOCAL_LLM_AND_WASM.md) — local LLM gateway + WASM deterministic gates.
- [`05-security/RLS_SECURITY_MODEL.md`](05-security/RLS_SECURITY_MODEL.md) — Row-Level Security: `app.user_id`, `app.user_role`, `app.workspace_id`.
- [`06-infra/INFRA_SUMMARY.md`](06-infra/INFRA_SUMMARY.md) — k3s, ingress, no `:latest`, staging before production.

### Sprint + QA + ops

- [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md) — current and planned sprints.
- [`07-sprints/SPRINT_10_DB_DECISIONS.md`](07-sprints/SPRINT_10_DB_DECISIONS.md) — locked Sprint 10 DB decisions.
- [`08-qa/QA_PROCESS.md`](08-qa/QA_PROCESS.md) — evidence-based QA, no PASS without command output.
- [`09-operations/OPERATIONS_RULES.md`](09-operations/OPERATIONS_RULES.md) — push / deploy / kubectl / secrets rules.

### Deep / historical references (not loaded by default)

Full long-form documents remain in `docs/iterlaw/` and `docs/infra/`. Read them only when a small doc above is insufficient. The small docs are the canonical entry point for new work.

## Hard warnings

1. **Do not use `RightsNow`** in active code, config, or documentation. Legacy markers only.
2. **No production deploy** without staging verification first. See [`09-operations/OPERATIONS_RULES.md`](09-operations/OPERATIONS_RULES.md).
3. **No legal answer without verified citations.** The orchestrator returns `insufficient_sources` / `needs_more_facts` / `citation_failed` before any model output. See [`01-architecture/ARCHITECTURE_SUMMARY.md`](01-architecture/ARCHITECTURE_SUMMARY.md).
4. **No external LLM call in the orchestrator request path.** Local LLM only, behind the gateway, behind retrieval + citation gates.
5. **No `:latest` image tag** in any active deployable manifest. See [`06-infra/INFRA_SUMMARY.md`](06-infra/INFRA_SUMMARY.md).
