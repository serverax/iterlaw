# AI Tool — Start Here

Entry point for Claude Code, Cursor, and any other AI agent acting on the IterLaw repository.

## Read order

1. **This file.**
2. [`../README.md`](../README.md) — the project documentation index.
3. **Only the small file directly relevant to your task.** Each numbered subdirectory (`01-architecture/`, `02-database/`, etc.) has one summary file kept under 150 lines.

Do **not** load every markdown file at the start of a task. The point of this directory is small, focused docs.

## What not to load by default

- Long-form documents under `docs/iterlaw/*.md` and `docs/infra/*.md` are the **deep reference**. Load them only when the small doc above is insufficient and the task explicitly requires the deeper detail.
- Reports under `reports/` are evidence artefacts. Read when the task references a specific report.
- Migration SQL under `apps/legal-orchestrator/db/migrations/` is the source of truth for the DB shape. Read it when the task is about a specific migration.

## Decisions you do not need to re-litigate

These are locked decisions; do not re-ask the user about them.

- **Names:** product / platform = IterLaw; forbidden active = RightsNow and any earlier platform-brand names. See [`CANONICAL_NAMES.md`](CANONICAL_NAMES.md).
- **Namespaces:** the five canonical namespaces. No `iterlaw-prod`, no bare `iterlaw`.
- **DB:** local / self-hosted PostgreSQL + pgvector. No public-cloud DB SDK in the browser path. See [`../02-database/DATABASE_SUMMARY.md`](../02-database/DATABASE_SUMMARY.md).
- **Sprint 10 DB tables:** `legal_cases` (corpus, migration `102`); `legal_case_records`, `legal_case_facts`, `legal_case_documents`, `legal_case_drafts`, `legal_case_timeline`, `legal_case_sources` (user-workspace, migration `105`); RLS in migration `106`. See [`../07-sprints/SPRINT_10_DB_DECISIONS.md`](../07-sprints/SPRINT_10_DB_DECISIONS.md).
- **`legal_case_timeline`** = user-workspace case journey timeline. Not the corpus case-law history.
- **`legal_case_sources`** = JOIN table from user case → corpus rows.
- **RLS** uses `app.user_id`, `app.user_role`, `app.workspace_id`. Fail-closed.
- **External LLM in answer path:** disabled by default.

## Rules of the road

- **Never push** without explicit operator instruction in the same message.
- **Never deploy** / `kubectl apply` / `helm install`.
- **Never `psql` against production.** Verifiers report `NOT EXECUTED` when `psql` is absent.
- **Never create real secrets** in the repo. Use `REPLACE_ME_*` placeholders + kubeseal.
- **Never call external LLMs** from the orchestrator answer path.
- **Never fabricate** citations, performance numbers, or completion claims.
- **No emojis** in code or new docs unless the user explicitly requests them.
- Mark unknown / unverified items as **NOT VERIFIED**. Mark unrun commands as **NOT EXECUTED**.

## When a small doc is not enough

Search for the long-form authoritative file under `docs/iterlaw/` or `docs/infra/` only after you have read the small doc and confirmed it does not contain the answer. Do not bypass the small doc.

## When the user gives you a different number / decision

If a user message asks you to act against a decision listed above, surface the conflict and ask before acting. Do not silently override locked decisions.
