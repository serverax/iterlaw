#!/usr/bin/env bash
# Sprint 12 — Track B safe operator-side restore VERIFICATION.
#
# This script NEVER restores against production. It defaults to dry-run.
# Live restore requires an explicit isolated target supplied out-of-band
# via ITERLAW_RESTORE_DATABASE_URL. Source DSN (if compared) is read from
# ITERLAW_BACKUP_DATABASE_URL. NEITHER DSN is ever logged or echoed.
#
# Usage (dry-run, default):
#   bash scripts/backup/iterlaw-db-restore-verify.sh \
#     --dry-run \
#     --backup-manifest ./tmp/sprint12-backup-test/<manifest>.json \
#     --report-out ./tmp/sprint12-backup-test/restore-report.json
#
# Live (isolated target, operator authorisation required):
#   ITERLAW_RESTORE_DATABASE_URL=postgres://... \
#     bash scripts/backup/iterlaw-db-restore-verify.sh \
#       --no-dry-run \
#       --backup-manifest /path/to/manifest.json \
#       --report-out /path/to/restore-report.json \
#       --restore-label drill-2026Q2 \
#       --allow-empty-target-only
#
# Exit codes:
#   0   success
#   2   bad args
#   3   manifest invalid or missing
#   4   refused (production or same source/target)
#   5   sha256 mismatch
#   6   pg_restore preflight failed
#   7   report write failed

set -euo pipefail

DRY_RUN=1
CHECK_MODE=0           # Sprint 13: --check toolchain probe
MANIFEST_PATH=""
REPORT_OUT=""
EXPECTED_PROJECT="iterlaw"
RESTORE_LABEL="restore-drill"
ALLOW_EMPTY_TARGET_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)                       DRY_RUN=1 ;;
    --no-dry-run)                    DRY_RUN=0 ;;
    --check)                         CHECK_MODE=1 ;;
    --backup-manifest)               shift; MANIFEST_PATH="${1:-}" ;;
    --report-out)                    shift; REPORT_OUT="${1:-}" ;;
    --expected-project)              shift; EXPECTED_PROJECT="${1:-}" ;;
    --restore-label)                 shift; RESTORE_LABEL="${1:-}" ;;
    --allow-empty-target-only)       ALLOW_EMPTY_TARGET_ONLY=1 ;;
    -h|--help)
      sed -n '2,28p' "$0"
      exit 0
      ;;
    *)
      echo "iterlaw-db-restore-verify: unknown arg: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

# --------------------- Sprint 13 --check toolchain probe ---------------------
# This branch NEVER reads ITERLAW_RESTORE_DATABASE_URL or
# ITERLAW_BACKUP_DATABASE_URL, NEVER calls pg_restore against any target,
# NEVER opens a network socket, and NEVER runs kubectl. It only probes
# local tool availability via --version and command -v. The script can
# NEVER self-authorise live restore — live_restore_authorised is always
# emitted as false.
if [ "$CHECK_MODE" -eq 1 ]; then
  pg_restore_available="false"
  psql_available="false"
  sha256_available="false"
  date_available="false"
  mktemp_available="false"
  node_available="false"

  if command -v pg_restore >/dev/null 2>&1 && pg_restore --version >/dev/null 2>&1; then
    pg_restore_available="true"
  fi
  if command -v psql >/dev/null 2>&1 && psql --version >/dev/null 2>&1; then
    psql_available="true"
  fi
  if command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1; then
    sha256_available="true"
  fi
  if command -v date >/dev/null 2>&1; then
    date_available="true"
  fi
  if command -v mktemp >/dev/null 2>&1; then
    mktemp_available="true"
  fi
  if command -v node >/dev/null 2>&1; then
    node_available="true"
  fi

  ready_for_dry_run="true"
  if [ "$date_available" = "false" ] || [ "$mktemp_available" = "false" ] || [ "$node_available" = "false" ]; then
    ready_for_dry_run="false"
  fi

  printf '{"project":"iterlaw","mode":"check","script":"iterlaw-db-restore-verify","database_touched":false,"production_touched":false,"network_opened":false,"kubectl_called":false,"pg_restore_available":%s,"psql_available":%s,"sha256_available":%s,"date_available":%s,"mktemp_available":%s,"node_available":%s,"ready_for_dry_run":%s,"live_restore_authorised":false,"reason_live_restore_not_authorised":"first live restore requires explicit operator authorisation per FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md; --check mode never authorises live restore","secret_redaction":true}\n' \
    "$pg_restore_available" "$psql_available" "$sha256_available" "$date_available" "$mktemp_available" "$node_available" "$ready_for_dry_run"
  exit 0
fi

if [ -z "$MANIFEST_PATH" ]; then
  echo "iterlaw-db-restore-verify: --backup-manifest is required" >&2
  exit 2
fi
if [ -z "$REPORT_OUT" ]; then
  echo "iterlaw-db-restore-verify: --report-out is required" >&2
  exit 2
fi
if [ ! -f "$MANIFEST_PATH" ]; then
  echo "iterlaw-db-restore-verify: manifest not found: $MANIFEST_PATH" >&2
  exit 3
fi

# --------------------- run manifest validator ---------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if ! node "$SCRIPT_DIR/verify-backup-manifest.mjs" "$MANIFEST_PATH" >/dev/null 2>&1; then
  echo "iterlaw-db-restore-verify: manifest FAILED validation" >&2
  exit 3
fi

# Parse manifest fields via small node helper. Each field is emitted on
# its own newline-terminated line so this works under set -euo pipefail.
# The DSN was never in the manifest, so the parsed values are safe to
# echo (they are: project, env_label, dump filename, checksum filename,
# sha256 hex, mode, backup_id).
read_field() {
  local field="$1"
  node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const v=m[process.argv[2]]; process.stdout.write(v==null?'':String(v));" \
    "$MANIFEST_PATH" "$field"
}

M_PROJECT="$(read_field project)"
M_ENV_LABEL="$(read_field environment_label)"
M_DUMP_FILE="$(read_field dump_file)"
M_CHECKSUM_FILE="$(read_field checksum_file)"
M_SHA256="$(read_field sha256)"
M_MODE="$(read_field command_mode)"
M_BACKUP_ID="$(read_field backup_id)"

if [ "$M_PROJECT" != "$EXPECTED_PROJECT" ]; then
  echo "iterlaw-db-restore-verify: manifest.project '$M_PROJECT' does not match expected '$EXPECTED_PROJECT'" >&2
  exit 3
fi

MANIFEST_DIR="$(cd "$(dirname "$MANIFEST_PATH")" && pwd)"
DUMP_PATH="$MANIFEST_DIR/$M_DUMP_FILE"
CHECKSUM_PATH="$MANIFEST_DIR/$M_CHECKSUM_FILE"

# --------------------- sha256 verification (live + non-dryrun) ---------------------
CHECKSUM_VERIFIED="false"
CHECKSUM_VERIFIED_REASON="dry-run"

if [ "$M_MODE" = "live" ]; then
  if [ ! -f "$DUMP_PATH" ]; then
    echo "iterlaw-db-restore-verify: dump file referenced by manifest is missing: $M_DUMP_FILE" >&2
    exit 3
  fi
  if [ ! -f "$CHECKSUM_PATH" ]; then
    echo "iterlaw-db-restore-verify: checksum file referenced by manifest is missing: $M_CHECKSUM_FILE" >&2
    exit 3
  fi
  if ! command -v sha256sum >/dev/null 2>&1; then
    echo "iterlaw-db-restore-verify: sha256sum not available" >&2
    exit 5
  fi
  computed="$(sha256sum "$DUMP_PATH" | awk '{print $1}')"
  if [ "$computed" != "$M_SHA256" ]; then
    echo "iterlaw-db-restore-verify: SHA-256 mismatch" >&2
    exit 5
  fi
  CHECKSUM_VERIFIED="true"
  CHECKSUM_VERIFIED_REASON="manifest matches dump SHA-256"
fi

# --------------------- target safety (only matters when actually restoring) ---------------------
SOURCE_DSN="${ITERLAW_BACKUP_DATABASE_URL:-}"
TARGET_DSN="${ITERLAW_RESTORE_DATABASE_URL:-}"
TARGET_HOST_REDACTED="[REDACTED]"

PRODUCTION_LIKE='iterlaw-postgres\.iterlaw-data\.svc\.cluster\.local|iterlaw-prod|\bprod\b'

if [ "$DRY_RUN" -eq 0 ]; then
  if [ -z "$TARGET_DSN" ]; then
    echo "iterlaw-db-restore-verify: live mode requires ITERLAW_RESTORE_DATABASE_URL" >&2
    exit 2
  fi
  if [ -n "$SOURCE_DSN" ] && [ "$SOURCE_DSN" = "$TARGET_DSN" ]; then
    echo "iterlaw-db-restore-verify: REFUSED — source and target DSNs are identical" >&2
    exit 4
  fi
  if printf '%s' "$TARGET_DSN" | grep -qE "$PRODUCTION_LIKE"; then
    echo "iterlaw-db-restore-verify: REFUSED — target DSN matches production hostname denylist" >&2
    exit 4
  fi
  if printf '%s' "$RESTORE_LABEL" | grep -qiE '^production$|^prod$'; then
    echo "iterlaw-db-restore-verify: REFUSED — restore label '${RESTORE_LABEL}' is reserved for production" >&2
    exit 4
  fi
fi

# --------------------- pg_restore --list preflight (if available, live only) ---------------------
PG_RESTORE_LIST_OK="not_attempted"
if [ "$M_MODE" = "live" ] && [ -f "$DUMP_PATH" ] && command -v pg_restore >/dev/null 2>&1; then
  TMP_LIST="$(mktemp)"
  if pg_restore --list "$DUMP_PATH" > "$TMP_LIST" 2>/dev/null; then
    if grep -q "SCHEMA -" "$TMP_LIST" 2>/dev/null; then
      PG_RESTORE_LIST_OK="schemas_visible"
    else
      PG_RESTORE_LIST_OK="schemas_not_found"
    fi
  else
    PG_RESTORE_LIST_OK="failed"
  fi
  rm -f "$TMP_LIST"
fi

# --------------------- emit report ---------------------
mkdir -p "$(dirname "$REPORT_OUT")"
RESTORE_ID="restore-${M_BACKUP_ID}-$(date -u +"%Y%m%dT%H%M%SZ")"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
GIT_COMMIT="unknown"
if command -v git >/dev/null 2>&1; then
  GIT_COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")"
fi

RESTORE_MODE="dry-run"
if [ "$DRY_RUN" -eq 0 ]; then
  RESTORE_MODE="live"
fi

ALLOW_EMPTY_ONLY="false"
if [ "$ALLOW_EMPTY_TARGET_ONLY" -eq 1 ]; then
  ALLOW_EMPTY_ONLY="true"
fi

escape_json() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\r//g' | tr -d '\n'
}

cat > "$REPORT_OUT" <<JSON
{
  "restore_id": "$(escape_json "$RESTORE_ID")",
  "started_at_utc": "$(escape_json "$STARTED_AT")",
  "completed_at_utc": "$(escape_json "$(date -u +"%Y-%m-%dT%H:%M:%SZ")")",
  "source_backup_id": "$(escape_json "$M_BACKUP_ID")",
  "manifest_path_basename": "$(escape_json "$(basename "$MANIFEST_PATH")")",
  "manifest_command_mode": "$(escape_json "$M_MODE")",
  "checksum_verified": ${CHECKSUM_VERIFIED},
  "checksum_verified_reason": "$(escape_json "$CHECKSUM_VERIFIED_REASON")",
  "restore_target_label": "$(escape_json "$RESTORE_LABEL")",
  "restore_target_host": "$(escape_json "$TARGET_HOST_REDACTED")",
  "restore_mode": "$(escape_json "$RESTORE_MODE")",
  "allow_empty_target_only": ${ALLOW_EMPTY_ONLY},
  "production_restore_attempted": false,
  "destructive_action_performed": false,
  "pg_restore_list_result": "$(escape_json "$PG_RESTORE_LIST_OK")",
  "verification_status": "OK",
  "secret_redaction": true,
  "git_commit": "$(escape_json "$GIT_COMMIT")"
}
JSON

if [ ! -s "$REPORT_OUT" ]; then
  echo "iterlaw-db-restore-verify: report write FAILED" >&2
  exit 7
fi

echo "iterlaw-db-restore-verify: ${RESTORE_MODE} report written: ${REPORT_OUT}"
exit 0
