# Sprint 13 — Operator Toolchain Check (workstation readiness)

> Workstation-only. Run before considering any live backup, but the
> first live backup itself still requires the
> [`FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`](FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md)
> decision. Running these probes does **NOT** authorise anything.

## 0. What this doc is for

Two short commands tell you whether your local workstation has the
tools required to use `scripts/backup/*` in dry-run and (later) live
modes. They do not connect to any database, do not require any DSN,
do not contact the cluster, and never print secrets.

```bash
bash scripts/backup/iterlaw-db-backup.sh --check
bash scripts/backup/iterlaw-db-restore-verify.sh --check
```

Each emits one line of JSON to stdout. Exit code 0 means the probe ran
to completion; the individual `*_available` flags inside the JSON
tell you which tools are missing.

## 1. Expected JSON shape

### Backup `--check`

```json
{
  "project": "iterlaw",
  "mode": "check",
  "script": "iterlaw-db-backup",
  "database_touched": false,
  "production_touched": false,
  "network_opened": false,
  "kubectl_called": false,
  "pg_dump_available": true,
  "sha256_available": true,
  "date_available": true,
  "mktemp_available": true,
  "ready_for_dry_run": true,
  "ready_for_live_backup": false,
  "reason_live_backup_not_ready": "operator authorisation and ITERLAW_BACKUP_DATABASE_URL required; --check mode never authorises live backup",
  "secret_redaction": true
}
```

`ready_for_live_backup` is always `false` in `--check` mode. Live
backup authorisation is recorded only in the operator decision
checklist, never in a script.

### Restore-verify `--check`

```json
{
  "project": "iterlaw",
  "mode": "check",
  "script": "iterlaw-db-restore-verify",
  "database_touched": false,
  "production_touched": false,
  "network_opened": false,
  "kubectl_called": false,
  "pg_restore_available": true,
  "psql_available": true,
  "sha256_available": true,
  "date_available": true,
  "mktemp_available": true,
  "node_available": true,
  "ready_for_dry_run": true,
  "live_restore_authorised": false,
  "reason_live_restore_not_authorised": "first live restore requires explicit operator authorisation per FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md; --check mode never authorises live restore",
  "secret_redaction": true
}
```

## 2. Windows (Git Bash)

### Install the toolchain

1. Install Git for Windows from https://gitforwindows.org/. Git Bash
   includes `bash`, `sha256sum`, `date`, `mktemp`, `find`.
2. Install PostgreSQL 16 client tools from
   https://www.postgresql.org/download/windows/. Pick the
   "Command Line Tools" feature; you do **not** need the server
   itself.
3. Install Node 20+ from https://nodejs.org/.
4. Add the Postgres `bin/` directory to your user PATH if the
   installer did not, e.g.
   `C:\Program Files\PostgreSQL\16\bin`.
5. Open a **new** Git Bash window so the PATH refresh takes effect.

### Verify

```bash
bash --version           # GNU bash 4+ (Git Bash ships 5.x)
pg_dump --version        # pg_dump (PostgreSQL) 16.x
pg_restore --version     # pg_restore (PostgreSQL) 16.x
sha256sum --help         # GNU coreutils
date -u +"%Y-%m-%dT%H:%M:%SZ"
mktemp --help
node --version           # v20.x or later
```

### Run the checks

```bash
cd /c/Users/kalsh/projects/iterlaw
bash scripts/backup/iterlaw-db-backup.sh --check
bash scripts/backup/iterlaw-db-restore-verify.sh --check
```

## 3. Linux (Debian / Ubuntu / Fedora / Arch)

### Install the toolchain

Debian / Ubuntu:

```bash
sudo apt update
sudo apt install -y bash coreutils postgresql-client-16 nodejs
# coreutils provides sha256sum, date, mktemp; nodejs from nodesource if you
# need v20+
```

Fedora:

```bash
sudo dnf install -y bash coreutils postgresql nodejs
```

Arch:

```bash
sudo pacman -S --needed bash coreutils postgresql-libs nodejs
```

### Verify + run

```bash
bash --version
pg_dump --version
pg_restore --version
sha256sum --help
node --version
bash scripts/backup/iterlaw-db-backup.sh --check
bash scripts/backup/iterlaw-db-restore-verify.sh --check
```

## 4. macOS

### Install the toolchain

Use Homebrew:

```bash
brew install bash coreutils postgresql@16 node@20
brew link --force postgresql@16
brew link --overwrite node@20
```

Notes:

- macOS ships `shasum`, not `sha256sum`. The Sprint 13 `--check`
  probe accepts either. The live-mode backup script prefers
  `sha256sum` and falls back to `shasum -a 256`. If you only have
  `shasum`, `sha256_available` in `--check` will be `true`; live
  mode currently calls `sha256sum` directly (operator note: a
  future sprint may add a `shasum` fallback in live mode).
- The Apple-supplied `bash` is 3.2; the Sprint 12/13 scripts test
  against bash ≥ 5. Install GNU bash via `brew install bash` and use
  it via `/opt/homebrew/bin/bash` or `/usr/local/bin/bash`.

### Verify + run

```bash
/opt/homebrew/bin/bash --version
pg_dump --version
pg_restore --version
shasum -a 256 --help   # macOS-native
node --version
/opt/homebrew/bin/bash scripts/backup/iterlaw-db-backup.sh --check
/opt/homebrew/bin/bash scripts/backup/iterlaw-db-restore-verify.sh --check
```

## 5. Troubleshooting

### 5.1 `pg_dump_available: false`

- Postgres client tools are not installed, or not in `$PATH`.
- Confirm with `command -v pg_dump`.
- On Windows, re-check that `C:\Program Files\PostgreSQL\16\bin` is in
  PATH; open a fresh Git Bash window.
- On Linux, install the `postgresql-client-16` (or distro equivalent)
  package.
- On macOS, ensure `brew link --force postgresql@16` ran successfully.

### 5.2 `pg_restore_available: false`

- Same package as `pg_dump`. Installing the Postgres client tools
  package brings both. If only one is missing, your install is
  partial — reinstall the client package.

### 5.3 `sha256_available: false`

- macOS without Homebrew coreutils still has `shasum`; the probe
  accepts it. If the flag is false even on macOS, run
  `command -v shasum` and `command -v sha256sum` to see which one (if
  any) is missing.
- Linux: install `coreutils`.
- Windows: Git Bash ships `sha256sum`. If missing, reinstall Git for
  Windows.

### 5.4 `node_available: false`

- The restore-verify script uses Node to parse the manifest JSON.
  Install Node 20+ from your platform's package manager.

### 5.5 PATH issue (Windows): "I installed Postgres but `pg_dump` not found"

- Open a fresh Git Bash window (PATH is read at shell start).
- Confirm: `command -v pg_dump`.
- If still missing, manually add the bin dir to your `~/.bashrc`:
  ```bash
  export PATH="/c/Program Files/PostgreSQL/16/bin:$PATH"
  ```
- `source ~/.bashrc` and re-run `--check`.

### 5.6 PATH issue (macOS): brew installs Postgres but `pg_dump` not found

- `brew link --force postgresql@16` is the canonical fix.
- For Apple Silicon Macs the brew prefix is `/opt/homebrew`; for
  Intel Macs it is `/usr/local`. Add the correct `bin` directory to
  your `~/.zshrc`:
  ```bash
  export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
  ```

### 5.7 `command -v pg_dump` shows the binary but `--check` reports false

- The probe calls `pg_dump --version >/dev/null 2>&1` and expects
  exit 0. A wrapper script that prompts interactively would fail
  this check. Run `pg_dump --version` directly; if it prompts or
  hangs, your installation is broken.

### 5.8 "I see secrets in my shell history"

- The `--check` mode does not read any env var. Your history would
  only contain a secret if **you** typed one. If you accidentally
  exported `ITERLAW_BACKUP_DATABASE_URL` with a real DSN, run
  `unset ITERLAW_BACKUP_DATABASE_URL` immediately and clear the
  affected history lines with `history -d <line-number>`.

## 6. Running before any live backup

Even after `--check` reports `ready_for_dry_run: true` and all
relevant tool flags are `true`, the first live backup is gated by
`FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`. The probe is a
**necessary** condition, not a sufficient one. Do not export
`ITERLAW_BACKUP_DATABASE_URL` until the checklist is completed and
signed.
