#!/usr/bin/env bash
# Sprint 12 — Track B safe operator-side IterLaw DB backup.
#
# Defaults to --dry-run. Never touches production. Never prints secrets.
# Reads the source DSN ONLY from ITERLAW_BACKUP_DATABASE_URL.
#
# Usage:
#   bash scripts/backup/iterlaw-db-backup.sh \
#     --dry-run \
#     --output-dir ./tmp/sprint12-backup-test \
#     --label sprint12-dry-run
#
# Live mode (operator authorisation required):
#   ITERLAW_BACKUP_DATABASE_URL=postgres://... \
#     bash scripts/backup/iterlaw-db-backup.sh \
#       --output-dir /var/backups/iterlaw \
#       --label local-staging \
#       --environment-label local-staging \
#       --no-dry-run
#
# Exit codes:
#   0   success (dry-run or live)
#   2   bad args
#   3   missing DSN in live mode
#   4   refused target (looks like production)
#   5   pg_dump failed
#   6   sha256 computation failed
#   7   manifest write failed

set -euo pipefail

# --------------------- defaults ---------------------
DRY_RUN=1                       # default safe
CHECK_MODE=0                    # Sprint 13: --check toolchain probe
OUTPUT_DIR=""
LABEL="iterlaw-backup"
ENV_LABEL="local-staging"
FORMAT="custom"                 # custom|plain|directory|tar
RETENTION_DAYS=14
MANIFEST_ONLY=0
DATABASE_LABEL="local-docker"   # human label; the raw DSN is never logged

# --------------------- parse args ---------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)              DRY_RUN=1 ;;
    --no-dry-run)           DRY_RUN=0 ;;
    --check)                CHECK_MODE=1 ;;
    --output-dir)           shift; OUTPUT_DIR="${1:-}" ;;
    --label)                shift; LABEL="${1:-}" ;;
    --environment-label)    shift; ENV_LABEL="${1:-}" ;;
    --format)               shift; FORMAT="${1:-}" ;;
    --retention-days)       shift; RETENTION_DAYS="${1:-}" ;;
    --manifest-only)        MANIFEST_ONLY=1 ;;
    --database-label)       shift; DATABASE_LABEL="${1:-}" ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "iterlaw-db-backup: unknown arg: $1" >&2
      exit 2
      ;;
  esac
  shift || true
done

# --------------------- Sprint 13 --check toolchain probe ---------------------
# This branch NEVER reads ITERLAW_BACKUP_DATABASE_URL, NEVER calls pg_dump
# against any target, NEVER opens a network socket, and NEVER runs kubectl.
# It only probes local tool availability via --version and command -v.
if [ "$CHECK_MODE" -eq 1 ]; then
  pg_dump_available="false"
  sha256_available="false"
  date_available="false"
  mktemp_available="false"

  if command -v pg_dump >/dev/null 2>&1; then
    if pg_dump --version >/dev/null 2>&1; then
      pg_dump_available="true"
    fi
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

  ready_for_dry_run="true"
  if [ "$date_available" = "false" ] || [ "$mktemp_available" = "false" ]; then
    ready_for_dry_run="false"
  fi

  # Single-line JSON to stdout. No DSN, no env value, no secret material.
  printf '{"project":"iterlaw","mode":"check","script":"iterlaw-db-backup","database_touched":false,"production_touched":false,"network_opened":false,"kubectl_called":false,"pg_dump_available":%s,"sha256_available":%s,"date_available":%s,"mktemp_available":%s,"ready_for_dry_run":%s,"ready_for_live_backup":false,"reason_live_backup_not_ready":"operator authorisation and ITERLAW_BACKUP_DATABASE_URL required; --check mode never authorises live backup","secret_redaction":true}\n' \
    "$pg_dump_available" "$sha256_available" "$date_available" "$mktemp_available" "$ready_for_dry_run"
  exit 0
fi

if [ -z "$OUTPUT_DIR" ]; then
  echo "iterlaw-db-backup: --output-dir is required" >&2
  exit 2
fi

case "$FORMAT" in
  custom|plain|directory|tar) ;;
  *) echo "iterlaw-db-backup: --format must be one of custom|plain|directory|tar" >&2; exit 2 ;;
esac

# --------------------- production-target refusal ---------------------
# The DSN is read ONLY from the env var; never log it.
SOURCE_DSN="${ITERLAW_BACKUP_DATABASE_URL:-}"

if [ "$DRY_RUN" -eq 0 ] && [ -z "$SOURCE_DSN" ]; then
  echo "iterlaw-db-backup: live mode requires ITERLAW_BACKUP_DATABASE_URL (refused empty target)" >&2
  exit 3
fi

# Refuse anything that looks like the in-cluster production hostname or
# is labelled production. We do this BY HOST/LABEL ONLY; we never echo
# the DSN itself.
production_like_host_pattern='iterlaw-postgres\.iterlaw-data\.svc\.cluster\.local|iterlaw-prod|\bprod\b'
production_like_label_pattern='^production$|^prod$'

if [ "$DRY_RUN" -eq 0 ] && [ -n "$SOURCE_DSN" ]; then
  # Extract host portion from the DSN without echoing the DSN. We only
  # match against the host pattern; matched value never leaves the script.
  if printf '%s' "$SOURCE_DSN" | grep -qE "$production_like_host_pattern"; then
    echo "iterlaw-db-backup: REFUSED — source DSN matches production hostname denylist" >&2
    exit 4
  fi
fi

if printf '%s' "$ENV_LABEL" | grep -qiE "$production_like_label_pattern"; then
  echo "iterlaw-db-backup: REFUSED — environment label '${ENV_LABEL}' is production" >&2
  exit 4
fi

# --------------------- prepare output ---------------------
mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ISO_NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

EXT="pgcustom"
case "$FORMAT" in
  plain)     EXT="sql"  ;;
  directory) EXT="dir"  ;;
  tar)       EXT="tar"  ;;
esac

DUMP_BASENAME="iterlaw-${LABEL}-${TIMESTAMP}.${EXT}"
CHECKSUM_BASENAME="${DUMP_BASENAME}.sha256"
MANIFEST_BASENAME="iterlaw-${LABEL}-${TIMESTAMP}.manifest.json"

DUMP_PATH="${OUTPUT_DIR%/}/${DUMP_BASENAME}"
CHECKSUM_PATH="${OUTPUT_DIR%/}/${CHECKSUM_BASENAME}"
MANIFEST_PATH="${OUTPUT_DIR%/}/${MANIFEST_BASENAME}"

# --------------------- tool versions ---------------------
PG_DUMP_VERSION="unknown"
if command -v pg_dump >/dev/null 2>&1; then
  PG_DUMP_VERSION="$(pg_dump --version 2>/dev/null | head -n1 | awk '{print $NF}' || echo "unknown")"
fi
BASH_VERSION_SHORT="${BASH_VERSION:-unknown}"
NODE_VERSION="unknown"
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version 2>/dev/null || echo "unknown")"
fi

# --------------------- git commit ---------------------
GIT_COMMIT="unknown"
if command -v git >/dev/null 2>&1; then
  GIT_COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")"
fi

# --------------------- backup id ---------------------
RAND_SUFFIX="${RANDOM:-0}${RANDOM:-0}"
BACKUP_ID="iterlaw-${LABEL}-${TIMESTAMP}-${RAND_SUFFIX}"

# --------------------- perform backup ---------------------
SHA256_HEX="null"
COMMAND_MODE="dry-run"

if [ "$DRY_RUN" -eq 1 ]; then
  COMMAND_MODE="dry-run"
  if [ "$MANIFEST_ONLY" -eq 0 ]; then
    # In dry-run, we DO NOT create the dump file. The manifest stands
    # alone, intentionally — the verifier accepts null sha256 for
    # dry-run. This is what keeps the dry-run cheap and reproducible.
    :
  fi
else
  COMMAND_MODE="live"
  if [ "$MANIFEST_ONLY" -eq 1 ]; then
    echo "iterlaw-db-backup: --manifest-only is not allowed in live mode" >&2
    exit 2
  fi

  # The DSN is passed via env var to pg_dump; we DO NOT inline it. We
  # also redirect stderr to a temp log so we can scan it for accidental
  # secret echo before letting it surface. pg_dump itself does not echo
  # the DSN, but be defensive.
  TMP_ERR="$(mktemp)"
  trap 'rm -f "$TMP_ERR"' EXIT

  PG_DUMP_CMD=(pg_dump --format="$FORMAT" --no-owner --no-privileges --schema=public)
  # Try to include uk_emp_rag if reachable. We do not probe; users who
  # want unconditional uk_emp_rag should set FORMAT=custom and run
  # pg_dump directly with their schema list. The simple operator path
  # captures public + best-effort uk_emp_rag.
  PG_DUMP_CMD+=(--schema=uk_emp_rag --file="$DUMP_PATH" "$SOURCE_DSN")

  if ! "${PG_DUMP_CMD[@]}" 2>"$TMP_ERR"; then
    # Sanitise stderr: never echo the DSN.
    if [ -s "$TMP_ERR" ]; then
      sed -e 's#postgres://[^ ]*#postgres://[REDACTED]#g' \
          -e 's#postgresql://[^ ]*#postgresql://[REDACTED]#g' \
          "$TMP_ERR" >&2 || true
    fi
    echo "iterlaw-db-backup: pg_dump FAILED" >&2
    exit 5
  fi

  if ! command -v sha256sum >/dev/null 2>&1; then
    echo "iterlaw-db-backup: sha256sum not available — cannot compute checksum" >&2
    exit 6
  fi

  if ! sha256sum "$DUMP_PATH" > "$CHECKSUM_PATH"; then
    echo "iterlaw-db-backup: sha256sum FAILED" >&2
    exit 6
  fi
  SHA256_HEX="$(awk '{print $1}' < "$CHECKSUM_PATH")"
fi

# --------------------- emit manifest ---------------------
# We deliberately hand-roll the JSON to avoid pulling in jq. Field
# values are sanitised first. The DSN is NEVER referenced here.
escape_json() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\r//g' | tr -d '\n'
}

SHA256_FIELD="null"
if [ "$SHA256_HEX" != "null" ]; then
  SHA256_FIELD="\"$(escape_json "$SHA256_HEX")\""
fi

COMPRESSED="true"
if [ "$FORMAT" = "plain" ]; then
  COMPRESSED="false"
fi

cat > "$MANIFEST_PATH" <<JSON
{
  "backup_id": "$(escape_json "$BACKUP_ID")",
  "created_at_utc": "$(escape_json "$ISO_NOW")",
  "project": "iterlaw",
  "environment_label": "$(escape_json "$ENV_LABEL")",
  "database_label": "$(escape_json "$DATABASE_LABEL")",
  "backup_format": "$(escape_json "$FORMAT")",
  "compressed": ${COMPRESSED},
  "dump_file": "$(escape_json "$DUMP_BASENAME")",
  "checksum_file": "$(escape_json "$CHECKSUM_BASENAME")",
  "sha256": ${SHA256_FIELD},
  "retention_days": ${RETENTION_DAYS},
  "tool_versions": {
    "pg_dump": "$(escape_json "$PG_DUMP_VERSION")",
    "bash": "$(escape_json "$BASH_VERSION_SHORT")",
    "node": "$(escape_json "$NODE_VERSION")"
  },
  "git_commit": "$(escape_json "$GIT_COMMIT")",
  "command_mode": "$(escape_json "$COMMAND_MODE")",
  "secret_redaction": true
}
JSON

if [ ! -s "$MANIFEST_PATH" ]; then
  echo "iterlaw-db-backup: manifest write FAILED" >&2
  exit 7
fi

# Print only manifest path; never the DSN, never the manifest body.
echo "iterlaw-db-backup: ${COMMAND_MODE} manifest written: ${MANIFEST_PATH}"
exit 0
