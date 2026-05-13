# ADR — Sprint 13 — Backup MVP Polish and Operator Readiness

## Status

**Accepted (Sprint 13 scope — OPERATOR-WORKSTATION READINESS ONLY).**

This ADR is accepted for the artefacts it produces. It does **NOT**
authorise:

- First live backup against any non-production database.
- First live restore against any target.
- Any production database touch.
- Any `kubectl apply` / `delete` / `patch` / `edit` / `scale` /
  `rollout` against any cluster.
- Any seal of a real credential.
- Any modification to the cluster-side Track A path
  (`k8s/iterlaw-data/backups/*`).

Authorisation for the first live backup remains a separate operator
decision, captured in
[`FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`](FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md).

## Context

Sprint 12 delivered the operator-workstation backup + restore-verify
scripts under `scripts/backup/` with a dry-run-by-default design.
Sprint 12 closed at PASS-FOR-DRY-RUN-FOUNDATION-ONLY — the scripts run
cleanly in dry-run but have never been exercised against a live
database. Two ergonomic gaps stop an operator from confidently going
live, even on a non-production target:

1. There is no zero-database tool-readiness probe. An operator who
   does not have `pg_dump`, `sha256sum`, or `pg_restore` installed
   only discovers that at live-run time, by which point they have
   already exported `ITERLAW_BACKUP_DATABASE_URL` into the shell.
2. There is no per-component smoke test that proves the Sprint 12
   additions did not perturb the orchestrator's `/ready` envelope or
   the `handleLegalRequest` answer-path safety properties.

Sprint 13 closes both gaps strictly within the operator workstation,
without going near production.

## Decision

Sprint 13 adds:

1. **`--check` mode** to `scripts/backup/iterlaw-db-backup.sh` and
   `scripts/backup/iterlaw-db-restore-verify.sh`. The `--check` mode
   never connects to any database, never calls `pg_dump` or
   `pg_restore` against any target, never requires a DSN, and emits a
   structured readiness report to stdout. `--check` is the safest
   possible mode in the script: no DB touch, no secret read, no
   network call.
2. **Operator toolchain doc** covering Windows / Linux / macOS
   prerequisites and troubleshooting for `pg_dump`, `pg_restore`,
   `sha256sum`/`shasum`, and PATH issues.
3. **Smoke tests** under `apps/legal-orchestrator/src/tests/` that:
   - confirm the orchestrator `/ready` envelope shape is unchanged by
     Sprint 13 changes;
   - confirm no backup env-var name (`ITERLAW_BACKUP_DATABASE_URL`,
     `ITERLAW_RESTORE_DATABASE_URL`) appears in any `/ready` response
     body;
   - confirm `handleLegalRequest` with mock RAG + mock transport still
     refuses to answer when retrieval returns zero chunks, and never
     reaches an external network;
   - cover the `--check` modes with 17 explicit safety tests.
4. **First-live-backup authorisation checklist** that records the
   exact operator decision required before any live backup is
   permitted. The default state on that checklist is
   `APPROVE FIRST LIVE BACKUP: NO / NOT AUTHORISED`.

## Scope

In scope:

- Add `--check` to `scripts/backup/iterlaw-db-backup.sh`.
- Add `--check` to `scripts/backup/iterlaw-db-restore-verify.sh`.
- New file `docs/iterlaw/project/13-backup-mvp-polish/SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md`.
- New file `docs/iterlaw/project/13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`.
- New test file `apps/legal-orchestrator/src/tests/sprint13BackupToolchainCheck.test.ts`.
- New test file `apps/legal-orchestrator/src/tests/sprint13BackupReadinessSmoke.test.ts`.
- This ADR + the Sprint 13 QA report.
- Coherent updates to the five status files
  (`PROJECT.md`, root + docs pointers, canonical project status,
  `SPRINT_INDEX.md`).

Out of scope:

- Any live backup against any database.
- Any live restore-verify against any target.
- Any `kubectl` command of any kind (the only available context is
  `aks-iterlaw-we-prod` — out of bounds).
- Any change to `apps/legal-orchestrator/src/legal/**` or
  `apps/legal-orchestrator/src/pipeline/**` or
  `apps/legal-orchestrator/src/types/**`.
- Any modification to `k8s/iterlaw-data/backups/*`.
- Any seal, rotate, or generate of credentials.
- Any change to canonical namespaces
  (`iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`,
  `iterlaw-security`).

## Rules carried over from Sprint 12

- Manifest must declare `secret_redaction: true`.
- Manifest must never contain a DSN literal.
- Restore-verify must refuse identical source/target DSN.
- Restore-verify must refuse production hostnames or labels.
- Manifest validator rejects `postgres://`, `postgresql://`,
  `POSTGRES_PASSWORD`, `PGPASSWORD`, `sk-`, `AKIA`, `ghp_`, GitHub
  PAT.

Sprint 13 strengthens but does not relax any Sprint 12 invariant.

## `--check` mode contract

The `--check` mode must satisfy ALL of the following:

- Requires zero environment variables. Even `ITERLAW_BACKUP_DATABASE_URL`
  is not consulted in this mode.
- Never calls `pg_dump` / `pg_restore` / `psql` against any target.
- Never opens any network socket.
- Never executes any `kubectl` command.
- Probes tool availability ONLY via `--version` and `command -v`.
- Emits a single JSON object to stdout, exactly one line, with the
  shape:
  ```json
  {
    "project": "iterlaw",
    "mode": "check",
    "database_touched": false,
    "production_touched": false,
    "pg_dump_available": true|false,
    "pg_restore_available": true|false,        // restore-verify only
    "sha256_available": true|false,
    "ready_for_dry_run": true|false,
    "ready_for_live_backup": false,             // backup only
    "live_restore_authorised": false,           // restore-verify only
    "reason_live_backup_not_ready": "...",      // backup only
    "reason_live_restore_not_authorised": "..." // restore-verify only
  }
  ```
- `ready_for_live_backup` and `live_restore_authorised` are always
  `false` from the script itself. Authorisation is exclusively an
  operator-side decision recorded in the checklist; the scripts
  cannot self-authorise.

## Smoke-test contract

The Sprint 13 smoke tests must:

- Boot the orchestrator app via the existing `createApp` /
  `buildExpressApp` factory (whichever the codebase exposes) without
  a `DATABASE_URL`.
- Hit `/ready` and assert the envelope still carries
  `legal_safety.citation_required: true`,
  `legal_safety.zero_citation_answer_blocked: true`,
  `llm.external_llm_enabled: false`.
- Assert the `/ready` body contains no `postgres://`,
  `postgresql://`, `POSTGRES_PASSWORD`, `PGPASSWORD`,
  `ITERLAW_BACKUP_DATABASE_URL`, `ITERLAW_RESTORE_DATABASE_URL`,
  `BORG_PASSPHRASE`, or `sk-…`.
- Exercise `handleLegalRequest` with a mock transport + empty RAG
  retrieval and assert the response is a refusal status
  (`insufficient_sources`, `safe_answer` with no draft, or
  `citation_failed`), not a fabricated answer.

## Forbidden actions for Sprint 13

- Live backup against any database — **forbidden**.
- Live restore against any target — **forbidden**.
- `kubectl` against any cluster — **forbidden**.
- Production DB touch — **forbidden**.
- Production claim ("production verified", "production approved",
  "ready for production", "deployed", "Sprint 13 PASS",
  "Sprint 13 complete") — **forbidden** in any committed artefact.

## Evidence required for PASS-FOR-OPERATOR-WORKSTATION-READINESS-ONLY

The Sprint 13 QA report must include:

1. `scripts/backup/iterlaw-db-backup.sh --check` exits 0 with the
   expected JSON shape, `database_touched: false`,
   `production_touched: false`, `ready_for_live_backup: false`.
2. `scripts/backup/iterlaw-db-restore-verify.sh --check` exits 0 with
   the same invariants and `live_restore_authorised: false`.
3. Vitest suite remains green (Sprint 12 baseline 59 / 802).
4. Smoke tests for `/ready` envelope + `handleLegalRequest` mock-RAG
   path pass.
5. Safety scans show zero unsafe credential exposure.
6. No `kubectl` command was run.

## Production status

**BLOCKED.** Sprint 13 does not unblock production. The first live
backup remains the gating decision and remains **NOT AUTHORISED**.

## Truth statement

- This ADR does not authorise live backup or live restore.
- This ADR does not authorise any production touch.
- This ADR governs only the four new files
  (`SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md`,
  `FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`, and two test files)
  plus the `--check` additions to the two Sprint 12 scripts plus
  status-doc updates.
- This ADR makes no claim that IterLaw is production ready.
