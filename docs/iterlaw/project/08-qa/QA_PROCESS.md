# IterLaw — QA Process

Evidence-based. No PASS without command output. No deployment claim without deployment evidence.

## Mandatory evidence for every PASS claim

Each of the following must appear in the QA report or commit message:

1. **Exact command(s) run.** Including the working directory.
2. **Exit code** of every command (`exit 0` etc.).
3. **Trimmed output** (last 5–10 lines is sufficient for a long log; full log for short commands).
4. **Test count summary** for vitest / jest runs (`Test Files X passed (X), Tests Y passed (Y)`).
5. **Verifier summary lines** for any `scripts/infra/verify-*.sh` or `scripts/qa/verify-*.sh` run.

If a command was not run, report `NOT EXECUTED` with the reason. If the result is unknown, report `NOT VERIFIED`. Never invent a PASS.

## Scoped vs whole-repo testing

Two distinct test surfaces:

| Surface | Command | Authority |
| --- | --- | --- |
| `apps/legal-orchestrator` (vitest) | `cd apps/legal-orchestrator && npx vitest run` | **Authoritative** for the orchestrator + RAG + safety-gate code. |
| Whole-repo (jest at root) | `npm test` from repo root | **PARTIAL by design.** Pre-existing issue: vitest test files cannot run under root jest, producing failed-suite noise. Do not let this block scoped work. |

A QA report may declare:
- `legal-orchestrator: PASS` + `whole-repo: PARTIAL` — accepted as long as the PARTIAL failure is the jest/vitest harness mismatch, not a legal-orchestrator regression.

## Required verifiers per touch

| If you touched … | Run these verifiers |
| --- | --- |
| Any active source under `apps/legal-orchestrator/src/` | `verify-iterlaw-repo.sh`, vitest |
| Any migration under `apps/legal-orchestrator/db/migrations/` | `verify-iterlaw-rag-db.sh`, vitest |
| Any active k8s manifest | `verify-iterlaw-repo.sh`, `verify-iterlaw-canonical-namespaces.sh` |
| Any backup-related file | `verify-iterlaw-backup.sh` |
| Any naming / policy doc / verifier | `verify-iterlaw-v3-safety.sh` |

## Static safety scans (always before commit)

Run these greps before committing anything sensitive:

- `RightsNow` / `rightsnow` — no new hits in active source (legacy-marked text allowed in `docs/CRUSER_*` / `.github/workflows-disabled/` / `k8s/iterlaw-disabled-*`).
- `:latest` — zero in any active deployable manifest. Ollama model tags (`uk-employment-qwen:latest` in ConfigMaps) are NOT container images — acceptable.
- Shape-anchored secret regex (`github_pat_`, `ghp_[A-Za-z0-9]{20,}`, `sk-[A-Za-z0-9]{48,}`, `sk-(proj|ant|svcacct)-…`, `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z_-]{35}`, PEM headers).
- External LLM URLs (`api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`) in `apps/legal-orchestrator/src/`.
- HTTP / fetch / curl / wget inside any SQL migration.
- `kubectl apply` of a remote URL.

`scripts/qa/verify-iterlaw-v3-safety.sh` automates most of these scoped greps.

## Secret hygiene

- Never print secret values in logs, output, reports, or commit messages.
- Use placeholders (`<DEV_DATABASE_URL_ONLY>`, `REPLACE_ME_*`) when documenting commands.
- Strip credentials from any error message that ever shows up in chat.

## Deployment claims

- Do **not** claim "deployed" unless `kubectl apply` was run by the operator with their authorisation and the output is captured.
- Do **not** claim "live" or "production" unless the same is true.
- "PR-ready" / "merge-ready" / "commit-ready" are allowed when verifiers + tests are green and the work is local. "Push-ready" requires the operator's explicit instruction.

## Reports must end with the truth statement

The agent report should end with the exact wording (each line, where applicable):

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.

This is the operator's grep-target for "is this turn safe?".
