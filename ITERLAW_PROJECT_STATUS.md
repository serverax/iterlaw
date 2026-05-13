# IterLaw Project Status

**Canonical status file moved.** This file is a pointer.

The canonical, up-to-date IterLaw project status lives at:

[`docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`](docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md)

Read that file for:

- Current delivery status (which sprint is in progress).
- Sprint count (total roadmap target, completed, remaining).
- Current blockers.
- Next sprint recommendation.
- Naming + guardrails.

Related quick links:

- Documentation index: [`docs/iterlaw/project/README.md`](docs/iterlaw/project/README.md)
- AI agent start-here: [`docs/iterlaw/project/00-index/AI_TOOL_START_HERE.md`](docs/iterlaw/project/00-index/AI_TOOL_START_HERE.md)
- Sprint index: [`docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`](docs/iterlaw/project/07-sprints/SPRINT_INDEX.md)
- Remaining sprint roadmap: [`docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md`](docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md)
- Operations rules: [`docs/iterlaw/project/09-operations/OPERATIONS_RULES.md`](docs/iterlaw/project/09-operations/OPERATIONS_RULES.md)
- Sprint 10 operator checklist: [`docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md)
- Offline-first ADR: [`docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md)

## Naming

Active product name: **IterLaw**. Do **not** use `RightsNow` in active material.

## Status snapshot

- Total roadmap: **57 sprints**. Completed: **15** (Sprints 1–11 PASS; Sprint 12 PASS-for-dry-run-foundation; Sprint 13 PASS-for-operator-workstation-readiness; Sprint 14 PASS-for-intelligence-foundation; Sprint 15 PASS-for-feature-flagged-local-wiring). Current: **Sprint 16** (planned start). Remaining: **42**. Range: **Sprint 16 → Sprint 57**.
- Sprint 10: **PASS** — Docker staging verification (2026-05-13; Docker scope only — not AKS, not production).
- Sprint 11: **PASS** — Phase 1 + Phase 2A + hardening + Phase 2B (commit `3681fab`) + Phase 4 (commit `120b9de`); full suite 58 files / 763 tests PASS.
- Sprint 12: **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side backup scripts + 39 tests (commits `a750f88` → `fdafca3`); full suite **59 files / 802 tests PASS**. Live backup + live restore **NOT EXECUTED**.
- Sprint 13: **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` probes + operator toolchain doc + first-live-backup checklist (default NO) + 25 new tests; full suite **61 files / 827 tests PASS**. First live backup + live restore **NOT AUTHORISED**.
- Sprint 14: **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — 11 intelligence modules + 54 tests + 6 architecture docs (commits `5470757`, `427e8ff`, `b53fa9a`). Not wired into answer path by this sprint.
- Sprint 15: **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — feature flag config + shadow-mode wiring + `/ready` additive field + 26 new tests; full suite **72 files / 907 tests PASS**. Intelligence Layer disabled by default.
- Sprints 16–57: **PLANNED only**.
- Production: **BLOCKED**.
- External LLM in live answer path: **FORBIDDEN**.
- Offline-first legal DB model: **ACCEPTED**.

Full detail in the canonical file linked above. Evidence: `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` + `reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md`. Sprint 11 task contract: `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`.
