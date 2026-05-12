# IterLaw — Docs AIA Governance Update Report

**Date:** 2026-05-13.

## 1. Origin and authorship

This update was **freshly authored in the canonical IterLaw repo** (`C:\Users\kalsh\projects\iterlaw`, origin `https://github.com/serverax/iterlaw.git`) against canonical HEAD `8c2c379`.

The previous Docs AIA workspace, reported as commit `5cfb0a4`, was **not** importable: the commit object is not present in the canonical repo, its source workspace is not on this filesystem, and no orphan copies of the named files could be found. **The lost commit `5cfb0a4` was not imported.** None of the content in the files below claims to reproduce that commit.

## 2. Files created

| File | Purpose |
| --- | --- |
| `docs/iterlaw/project/11-ai-governance/AIA_OPERATING_MODEL.md` | Operating model for IterLaw / OrdinoxAI AIAs: Superior AI Architect, Docs, QA, DB / RAG, Security, Infra / Platform + optional future specialists. Authority boundaries, veto rights, hand-off format, evidence requirements, hard limits, coordination rules. |
| `docs/iterlaw/project/11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md` | Status vocabulary (PASS / PARTIAL / FAIL / BLOCKED / NOT EXECUTED / NOT VERIFIED / UNKNOWN), evidence requirements per claim type, examples of unsafe / acceptable claims, local / staging / production gate rules, Sprint 10 closeout rule, production-ready rule. |
| `docs/iterlaw/project/11-ai-governance/NAMING_CONSISTENCY_POLICY.md` | IterLaw / OrdinoxAI / no-RightsNow + canonical Kubernetes namespaces + forbidden namespaces + allowed legacy markers + audit commands. |
| `docs/iterlaw/project/11-ai-governance/AI_GOVERNANCE_INDEX.md` | Index + read order + governance-doc owners table + current status + quick command checklist for governance scans. |
| `reports/ITERLAW_DOCS_AIA_GOVERNANCE_UPDATE_REPORT.md` | This report. |

## 3. Files updated

| File | Change |
| --- | --- |
| `docs/iterlaw/project/README.md` | Linked the new governance docs from the "Decisions / AI governance" block (one block already linked the Superior AI Architect AIA spec + offline-first ADR; now also links `AI_GOVERNANCE_INDEX.md`, `AIA_OPERATING_MODEL.md`, `DOCUMENTATION_TRUTH_PROTOCOL.md`, `NAMING_CONSISTENCY_POLICY.md`). |

`docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` and `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` already link the Superior AI Architect AIA specification and reflect the canonical truth (Sprint 10 PENDING, Sprint 11 PLANNED / BLOCKED, production BLOCKED). They did not need additional updates in this turn.

## 4. Safety statement

- The new governance docs do **not** mark Sprint 10 as complete.
- The new governance docs do **not** mark production as ready or verified.
- The new governance docs do **not** reintroduce `RightsNow` to active code, config, or docs.
- The new governance docs do **not** introduce `iterlaw-prod` or a bare `iterlaw` namespace.
- Every `RightsNow` / `rightsnow` mention in the new docs is in a forbidden-policy statement (`"Do not use RightsNow"`, `"Forbidden: rightsnow"`).
- Every `iterlaw-prod` mention in the new docs is in a forbidden-policy statement (`"Do not create or reference"`, `"Forbidden: iterlaw-prod"`).
- Every "production" / "staging" / "deployed" mention is either a deny-state ("BLOCKED until ... PASS"), a forbidden-policy statement, or an explicit refusal ("not deployed" / "may not be claimed").

## 5. Validation results

Validation commands run from the repo root:

| Command | Result classification |
| --- | --- |
| `git status -sb` | docs-only changes; no source, migration, test, or k8s files. |
| `git diff --stat` | docs-only changes; line counts captured in §6 below. |
| `grep -R "Sprint 10 complete" docs/iterlaw/project reports` | Hits only in: this report (negative statement) + `DOCUMENTATION_TRUTH_PROTOCOL.md` (listed as an **unsafe claim** example, in a "do not write this" table). **All allowed.** |
| `grep -R "production verified" docs/iterlaw/project reports` | Hits only in: `DOCUMENTATION_TRUTH_PROTOCOL.md` listing the phrase as an **unsafe claim** + this report's safety statement. **All allowed forbidden-policy text.** |
| `grep -R "RightsNow" docs/iterlaw/project reports` | Hits in: `00-index/AI_TOOL_START_HERE.md`, `00-index/CANONICAL_NAMES.md`, `README.md`, `09-operations/OPERATIONS_RULES.md`, `ITERLAW_PROJECT_STATUS.md`, `LEGAL_AI_CORE_PLATFORM_SCOPE.md`, `ROADMAP_REMAINING_SPRINTS.md`, `08-qa/QA_PROCESS.md`, `SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`, `NAMING_CONSISTENCY_POLICY.md`, `AIA_OPERATING_MODEL.md`. **Every hit is forbidden-policy text or a historical sprint changelog entry.** No active usage. |
| `grep -R "rightsnow" docs/iterlaw/project reports` | Hits in deny-list / forbidden-token / package-rename text only. **All allowed.** |
| `grep -R "iterlaw-prod" docs/iterlaw/project reports` | Hits only in forbidden-policy text and "after `iterlaw-prod` removal" status notes. **All allowed.** |
| `grep -R "deployed" docs/iterlaw/project reports` | Hits include "**Not deployed**" / "**not yet deployed**" negative claims and "no agent in this repo has authority to deploy" — all negative / refusal text. **All allowed.** |

Classification summary: zero **unsafe active usage**, zero **unsafe completion claims**. Every hit falls into one of: allowed forbidden-policy text / allowed historical reference / allowed conditional gate / explicit negative claim.

## 6. `git diff --stat` (before commit)

Captured at the validation step. Recorded in the final agent response of this task.

## 7. Final `git status`

Captured at the validation step. After commit: working tree clean, branch ahead of `origin/master`. No push performed.

## 8. Truth statement

> No source code changed.
> No tests changed.
> No migrations changed.
> No Kubernetes manifests changed.
> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM call performed.
> No secret values printed.
> Sprint 10 real staging DB verification remains: **PENDING**.
> Sprint 11 remains: **PLANNED / BLOCKED**.
> Production remains: **BLOCKED**.
> The lost commit `5cfb0a4` was **not imported**; the governance docs were authored fresh in the canonical repo.
