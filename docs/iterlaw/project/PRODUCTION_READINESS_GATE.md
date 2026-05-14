# IterLaw Production Readiness Gate

> **Production readiness = NO** until every required gate in this document is recorded as PASS with captured evidence under `reports/`.
>
> No agent, no operator override, and no doc rewrite can declare IterLaw production-ready while any gate remains BLOCKED, PARTIAL, or NOT_VERIFIED.

This document and the companion checklist (`PRODUCTION_READINESS_GATE.json`) plus the verifier script (`scripts/verify-production-readiness-gate.mjs`) form a single, machine-checkable production-readiness contract.

---

## How the gate works

1. `PRODUCTION_READINESS_GATE.json` lists every required gate with `gate_id`, `gate_name`, `status`, `evidence_path`, `command`, `last_verified_at`, `blocker`.
2. `scripts/verify-production-readiness-gate.mjs` reads that JSON. It exits **non-zero if any gate is not `PASS`**. It exits **0 only when every gate is `PASS`**.
3. The script does **not** touch network, DB, K3s, or external LLMs. It is a pure read-only verifier of the JSON state.
4. To move a gate from `PARTIAL`/`BLOCKED`/`NOT_VERIFIED` to `PASS`, the operator must:
   - Run the documented `command`.
   - Capture exact output under `evidence_path`.
   - Update the `status`, `last_verified_at`, and clear `blocker`.
   - Commit and push the JSON change alongside the evidence report.
5. For G12 (live backup) + G13 (live restore) specifically, Sprint 12L added `scripts/operator/apply-live-backup-restore-evidence-gate.ps1`. The operator:
   - Runs the live backup + restore drill per the runbook.
   - Fills the Sprint 12G evidence templates with redacted output.
   - Runs `scripts/operator/validate-live-backup-restore-evidence.ps1 <path>` on each (must exit 0).
   - Runs `pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 -BackupEvidencePath <path> -RestoreEvidencePath <path> -DryRun` (prints the planned delta; does not write).
   - Re-runs the same command **without** `-DryRun` to atomically flip G12 + G13 in this JSON file.
   - Commits the JSON change alongside the redacted evidence reports.

---

## Required gates

| ID | Gate | Status (as of 2026-05-13) | Blocker |
|----|------|---------------------------|---------|
| G01 | Root typecheck PASS | PASS | — |
| G02 | Root lint PASS | PASS | — |
| G03 | Root build PASS | PASS | — |
| G04 | Root tests PASS (jest) | PASS | — |
| G05 | legal-orchestrator typecheck PASS | PASS | — |
| G06 | legal-orchestrator build PASS | PASS | — |
| G07 | legal-orchestrator tests PASS (vitest) | PASS | — |
| G08 | `npm audit --omit=dev` has zero unresolved applicable production advisories | PARTIAL | 1 high Next.js advisory; requires change-controlled upgrade to `next@15.5.16+` or `next@16.x`. PostCSS resolved in Sprint 12E. |
| G09 | Docker staging migration replay PASS (full forward migration chain on `pgvector/pgvector:pg16`) | NOT_VERIFIED | Sprint 14 deliverable; replay script ready but live Docker daemon execution requires operator. |
| G10 | K3s read-only cluster verification PASS (nodes/pods/services/ingress) | NOT_VERIFIED | Sprint 15 deliverable; SSH/kubectl access to master `138.201.253.56` required. |
| G11 | Traefik / live ingress route verification PASS | NOT_VERIFIED | Tied to G10. |
| G12 | Live backup dry-run PASS (Sprint 12) | PASS-FOR-DRY-RUN-ONLY | Live backup execution NOT AUTHORISED per Sprint 13 checklist (operator decision). |
| G13 | Live restore verification PASS | NOT_VERIFIED | Live restore NOT AUTHORISED. |
| G14 | External LLM legal-answer path blocked by default | PASS | `apps/legal-orchestrator` transport deny policy + Sprint 12B `ITERLAW_WEB_AI_FALLBACK_ENABLED` flag default OFF. |
| G15 | Citation gates active (`citation_required`, `zero_citation_answer_blocked`) | PASS | Tested in orchestrator suite; surfaced in `/ready`. |
| G16 | No secret values committed to repo | PASS | Sprint 12B grep + Sprint 12C grep show no real secret committed. |
| G17 | No false `production ready` / `deployed` / `live verified` claim in active docs | PASS | Sprint 12C reconciled; remaining hits are governance, procedural, pedagogical, or historical. |

Statuses use the controlled vocabulary:

- `PASS` — evidence captured under `evidence_path`; verification command run; reproducible.
- `PARTIAL` — partial pass with named scope; full pass requires named follow-up.
- `BLOCKED` — known blocker with named cause; cannot pass without resolving cause.
- `NOT_VERIFIED` — no recent capture of evidence; status unknown.
- `FAIL` — verification ran and failed.

The verifier script treats anything other than `PASS` as a gate failure.

---

## Production readiness output

```
$ node scripts/verify-production-readiness-gate.mjs
```

- Exits `0` only when **every** required gate is `PASS`.
- Otherwise exits non-zero and prints the failing gate IDs and their blockers.

This is the **single point of truth** for whether IterLaw is production-ready. No doc or commit message can override the verifier.

---

## Forbidden actions

- No agent, operator, or commit may flip a gate to `PASS` without captured evidence under `evidence_path`.
- No agent may delete or mutate gates retroactively.
- No agent may declare IterLaw production-ready while the verifier exits non-zero.
- No external LLM call, no `kubectl apply / delete / patch`, no production DB write, no force-push, no history rewrite.

---

## Companion files

- `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` — machine-readable checklist.
- `scripts/verify-production-readiness-gate.mjs` — verifier.
- `reports/ITERLAW_SPRINT_13_PRODUCTION_READINESS_GATE.md` — Sprint 13 implementation report.
