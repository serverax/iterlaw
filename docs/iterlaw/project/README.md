# IterLaw — Project Documentation Index

> **AI agents:** start at [`00-index/AI_TOOL_START_HERE.md`](00-index/AI_TOOL_START_HERE.md). Only load the small file relevant to your task. Do not load every markdown file.

## At a glance

- **Product:** IterLaw — legal AI assistant. First beta is **UK Employment Law**.
- **Active product name:** **IterLaw**. Do **not** use `RightsNow` unless it is clearly inside legacy / disabled / archive material.
- **Default DB:** local / self-hosted PostgreSQL + pgvector. No public-cloud DB dependency.
- **External LLM in answer path:** disabled by default.

## Current scope

IterLaw is **one legal AI platform**, not one app per area of law.

- IterLaw starts with **UK Employment Law** as its first beta.
- Future expansion supports **multiple countries** (UK, Sweden, Germany, France, Netherlands, Norway, Denmark, UAE, Saudi Arabia, then more) and **multiple legal domains** (Employment, Immigration, Housing, Benefits, Family, Debt, Consumer, Business, Tax).
- Users select a **country**, a **legal module / area of law**, and a **subscription plan**.
- Subscriptions unlock access to one or more modules. **Multi-module discounts are planned.**
- Each module owns its own RAG corpus, legal sources, rules, prompts, templates, calculators, citation policy, and specialist AIA workflows.
- The shared platform (login, billing, dashboard, chat UI, case management, document engine, notification system, RAG engine, AI routing, audit, monitoring, Postgres + pgvector, Redis cache, WASM deterministic modules) is the same across modules.

Architecture details: [`01-architecture/`](01-architecture/) (see `LEGAL_AI_CORE_PLATFORM_SCOPE.md`, `MODULE_SUBSCRIPTION_ARCHITECTURE.md`, `LAW_MODULE_ENGINE_ARCHITECTURE.md`, `WASM_INTELLIGENCE_ARCHITECTURE.md`, `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `SUPREME_CONTROLLER_ARCHITECTURE.md`, `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md`).

## Current status (high level)

- Sprints 1–9: completed (see [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md)).
- Sprint 10: repo + local Docker DB **PASS**. **Real staging DB verification: PENDING.** Production: **BLOCKED**.
- Sprint 11: foundation + Phase 2A audit/transport guardrails **PASS**. Live HTTP transport: **NOT STARTED**. Pipeline wiring: **NOT STARTED**. Gateway: **DISABLED / MOCK-SAFE**.
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

- [`01-architecture/ARCHITECTURE_SUMMARY.md`](01-architecture/ARCHITECTURE_SUMMARY.md) — one-app/many-modules, country + module routing, subscription gate, specialist isolation, shared core, local-first cost model, LLM as slow path.
- [`02-database/DATABASE_SUMMARY.md`](02-database/DATABASE_SUMMARY.md) — Postgres + pgvector + Sprint 10 user-case workspace tables + future-target platform tables.
- [`03-rag/RAG_SUMMARY.md`](03-rag/RAG_SUMMARY.md) — module-specific RAG + multi-tier retrieval target.
- [`04-ai-llm/LOCAL_LLM_AND_WASM.md`](04-ai-llm/LOCAL_LLM_AND_WASM.md) — local LLM gateway + WASM deterministic gates.
- [`05-security/RLS_SECURITY_MODEL.md`](05-security/RLS_SECURITY_MODEL.md) — Row-Level Security: `app.user_id`, `app.user_role`, `app.workspace_id`.
- [`06-infra/INFRA_SUMMARY.md`](06-infra/INFRA_SUMMARY.md) — k3s, ingress, no `:latest`, staging before production.

### Sprint + QA + ops

- [`ITERLAW_PROJECT_STATUS.md`](ITERLAW_PROJECT_STATUS.md) — canonical project status.
- [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md) — current and planned sprints.
- [`07-sprints/ROADMAP_REMAINING_SPRINTS.md`](07-sprints/ROADMAP_REMAINING_SPRINTS.md) — remaining-sprint roadmap (Sprint 45 target).
- [`07-sprints/SPRINT_10_DB_DECISIONS.md`](07-sprints/SPRINT_10_DB_DECISIONS.md) — locked Sprint 10 DB decisions.
- [`08-qa/QA_PROCESS.md`](08-qa/QA_PROCESS.md) — evidence-based QA, no PASS without command output.
- [`09-operations/OPERATIONS_RULES.md`](09-operations/OPERATIONS_RULES.md) — push / deploy / kubectl / secrets rules.

### Decisions / AI governance

- [`10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md) — offline-first ADR.
- [`11-ai-governance/AI_GOVERNANCE_INDEX.md`](11-ai-governance/AI_GOVERNANCE_INDEX.md) — AI governance index (read first).
- [`11-ai-governance/AIA_OPERATING_MODEL.md`](11-ai-governance/AIA_OPERATING_MODEL.md) — how named AIAs operate.
- [`11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md`](11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md) — status vocabulary + evidence requirements.
- [`11-ai-governance/NAMING_CONSISTENCY_POLICY.md`](11-ai-governance/NAMING_CONSISTENCY_POLICY.md) — IterLaw / OrdinoxAI / no-RightsNow + canonical namespaces.
- [`11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md) — Superior AI Architect AIA governance specification.

### Deep / historical references (not loaded by default)

Full long-form documents remain in `docs/iterlaw/` and `docs/infra/`. Read them only when a small doc above is insufficient.

## Hard warnings

1. **Do not use `RightsNow`** in active code, config, or documentation. Legacy markers only.
2. **No production deploy** without staging verification first. See [`09-operations/OPERATIONS_RULES.md`](09-operations/OPERATIONS_RULES.md).
3. **No legal answer without verified citations.** The orchestrator returns `insufficient_sources` / `needs_more_facts` / `citation_failed` before any model output. See [`01-architecture/ARCHITECTURE_SUMMARY.md`](01-architecture/ARCHITECTURE_SUMMARY.md).
4. **No external LLM call in the orchestrator request path.** Local LLM only, behind the gateway, behind retrieval + citation gates.
5. **No `:latest` image tag** in any active deployable manifest. See [`06-infra/INFRA_SUMMARY.md`](06-infra/INFRA_SUMMARY.md).
6. **No cross-module / cross-country retrieval** in the answer path. Every legal question routes through the selected country + module.
7. **No access to an unsubscribed module.** Subscription entitlement is enforced at the backend, not just the UI.
