# First Live Backup — Operator Authorisation Checklist

> Default status: **APPROVE FIRST LIVE BACKUP: NO / NOT AUTHORISED.**
>
> No script, no test, no agent, and no automation in this repository
> can flip this default. Only a human operator may sign this
> checklist, and that signature is the only thing that authorises a
> first live backup.

## 0. Purpose

This is a one-page decision document. It records the conditions that
must all be true before the operator runs the **first** `pg_dump` from
the workstation against a real (non-production) database. Subsequent
live backups inherit any authorisation granted here only if their
scope (target, label, output directory) is unchanged.

## 1. What must be true before first live backup

Tick each box only after personally confirming the underlying state.
Do not tick from memory.

### 1.1 Isolated target chosen

- [ ] An isolated, non-production target has been chosen.
- [ ] Target host is **NOT**
  `iterlaw-postgres.iterlaw-data.svc.cluster.local`.
- [ ] Target host does **NOT** match `iterlaw-prod` or `\bprod\b`.
- [ ] Target environment label is **NOT** `production` or `prod`.

### 1.2 Non-production restore target available

- [ ] A separate, empty Postgres pod / container / VM is reserved for
  any later restore drill.
- [ ] Restore target host differs from backup source host.
- [ ] Restore target is on a **different** machine, network, or namespace from
  the source.

### 1.3 DSN management

- [ ] `ITERLAW_BACKUP_DATABASE_URL` is available **only in the operator's
  shell environment** (not in dotfiles, not in a CI secret, not in chat,
  not in screenshots).
- [ ] No DSN has been committed to git at any point.
- [ ] No DSN is present in `~/.bash_history`, `~/.zsh_history`,
  `~/.psql_history`, or any other shell history file (operator has
  truncated/removed the relevant lines).
- [ ] No DSN is in the operator's clipboard.

### 1.4 Backup output directory

- [ ] An explicit output directory under `--output-dir` has been
  chosen.
- [ ] That directory is on **encrypted disk** (FileVault / BitLocker /
  LUKS / dm-crypt or equivalent).
- [ ] That directory is **not** inside the IterLaw repo working tree.
- [ ] Disk space available in that directory is at least **2 ×** the
  expected dump size.

### 1.5 Toolchain ready

- [ ] `bash scripts/backup/iterlaw-db-backup.sh --check` reports:
  - `pg_dump_available: true`
  - `sha256_available: true`
  - `date_available: true`
  - `mktemp_available: true`
  - `ready_for_dry_run: true`
- [ ] `bash scripts/backup/iterlaw-db-restore-verify.sh --check` reports:
  - `pg_restore_available: true`
  - `sha256_available: true`
  - `node_available: true`
  - `ready_for_dry_run: true`

### 1.6 Recent dry-run evidence

- [ ] A dry-run backup against the same `--output-dir` and `--label`
  was performed within the last 24 hours.
- [ ] The manifest from that dry-run passed
  `node scripts/backup/verify-backup-manifest.mjs <path>`.
- [ ] A dry-run restore-verify report was produced and inspected — no
  DSN, no password, no DSN-like sentinel anywhere in either artefact.

### 1.7 Restore plan approved

- [ ] An operator-approved plan exists describing how the resulting
  backup will be restore-verified into the isolated target within
  72 hours of being produced. The plan names: target host, target
  label (`--restore-label`), expected schemas, and a row-count
  smoke query.

### 1.8 Operator authorisation explicit

- [ ] The operator has explicitly authorised this single live backup
  in writing (operator notes, signed Markdown, or equivalent).
- [ ] The authorisation names the scope (source, output directory,
  label, retention) and does not extend to subsequent backups
  beyond identical-scope repeats.

## 2. What remains forbidden, regardless of any sign-off here

- **Live restore against production.** Forbidden. No checklist item
  here grants this. Production-restore decisions are a separate
  document.
- **`kubectl apply / delete / patch / edit / scale / rollout` against
  any cluster.** Forbidden by operations rules.
- **Printing secrets** in chat, logs, screenshots, commit messages,
  PR descriptions, or runtime traces.
- **Committing DSNs** in any form (raw, base64, comment, test
  fixture).
- **Claiming production-ready** because a backup ran. A backup is
  necessary but not sufficient. Production readiness has its own
  gating (security review, SLOs, monitoring, alerting, PSP/PSS
  baseline, ingress TLS, SealedSecret rotation, on-call rota).

## 3. Decision box

```
APPROVE FIRST LIVE BACKUP:        ☐ YES   ☑ NO  (default NO)

Approved by:           ____________________________________
Date (UTC):            ____________________________________
Scope:                 ____________________________________
                       (source host, output dir, label, retention)
Rollback procedure:    ____________________________________
                       (how to abort and clean up on failure)
Evidence path:         ____________________________________
                       (operator notes / signed Markdown URL)
```

The default value is **NO**. Leaving any box in §1 unticked, or
leaving §3 unsigned, means **NOT AUTHORISED**. Do not export
`ITERLAW_BACKUP_DATABASE_URL`; do not run `--no-dry-run`.

## 4. After the first live backup

If the first live backup completes successfully:

1. Move the dump + manifest + sha256 to encrypted storage.
2. Run the restore-verify drill into the isolated target within 72
   hours per §1.7.
3. Record the dump basename, manifest path, and restore-verify
   report path in operator notes.
4. Do **not** treat this authorisation as a standing approval for
   future backups against different targets or labels — re-tick the
   checklist for any scope change.

## 5. Truth statement (default)

- First live backup authorised: **NO**.
- First live restore authorised: **NO**.
- Production restore authorised: **NO**.
- Production touched by this checklist: **NO**.
- `kubectl` action authorised by this checklist: **NO**.
- IterLaw production-ready as a consequence of this checklist: **NO**.
