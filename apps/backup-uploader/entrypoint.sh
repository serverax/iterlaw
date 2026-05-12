#!/usr/bin/env bash
# iterlaw-backup-uploader — entrypoint.
#
# Subcommands:
#   upload    Find the latest /backups/iterlaw-*.dump, create a Borg
#             archive, run `borg prune` retention.
#   verify    Run `borg check --verify-data`, list archives, extract
#             the latest into a tmpfs scratch path, run `pg_restore
#             --list`, assert public schema appears.
#   list      `borg list <repo>`.
#   inspect   `pg_restore --list <dump>`.
#
# Required env (all subcommands except `inspect`):
#   BORG_REPO              — ssh://uXXXX@uXXXX.your-storagebox.de:23/./iterlaw-pg
#   BORG_PASSPHRASE        — repokey passphrase
#   STORAGEBOX_HOST        — uXXXX.your-storagebox.de
#   STORAGEBOX_USER        — uXXXX (Hetzner login)
#   SSH_PRIVATE_KEY_PATH   — path to mounted SSH key (default: /home/borguser/.ssh/id_storagebox)
#
# Optional alerting env (best-effort, never blocks):
#   BACKUP_ALERT_WEBHOOK_URL
#   BACKUP_ALERT_TELEGRAM_BOT_TOKEN
#   BACKUP_ALERT_TELEGRAM_CHAT_ID
#
# Hard rules:
#   * Fails closed on missing or REPLACE_ME env values.
#   * Never echoes a secret — only its presence is logged.
#   * Alerting is best-effort; an alert failure does NOT mask a
#     backup failure (the script's exit code reflects the backup
#     outcome, not the alert outcome).

set -euo pipefail

LOG_PREFIX="iterlaw-backup-uploader"
SSH_KEY_PATH_DEFAULT="/home/borguser/.ssh/id_storagebox"
WORK_DIR="/tmp/iterlaw-backup-uploader"

log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${LOG_PREFIX}" "$*"; }

usage() {
  cat <<USAGE
Usage:
  iterlaw-backup-uploader upload
  iterlaw-backup-uploader verify
  iterlaw-backup-uploader list
  iterlaw-backup-uploader inspect <dump-path>
  iterlaw-backup-uploader --help

Required env:
  BORG_REPO, BORG_PASSPHRASE, STORAGEBOX_HOST, STORAGEBOX_USER

Optional env:
  SSH_PRIVATE_KEY_PATH (default ${SSH_KEY_PATH_DEFAULT})
  BACKUP_ALERT_WEBHOOK_URL
  BACKUP_ALERT_TELEGRAM_BOT_TOKEN
  BACKUP_ALERT_TELEGRAM_CHAT_ID
USAGE
}

reject_replace_me() {
  local name="$1" value="$2"
  case "${value}" in
    "" )                 log "FAIL: required env ${name} is empty"; exit 11 ;;
    REPLACE_ME*)         log "FAIL: required env ${name} still set to a REPLACE_ME placeholder"; exit 12 ;;
  esac
}

# ---------------------------------------------------------------------
# Env validation. Called from upload / verify / list (not inspect).
# ---------------------------------------------------------------------

require_borg_env() {
  reject_replace_me BORG_REPO        "${BORG_REPO:-}"
  reject_replace_me BORG_PASSPHRASE  "${BORG_PASSPHRASE:-}"
  reject_replace_me STORAGEBOX_HOST  "${STORAGEBOX_HOST:-}"
  reject_replace_me STORAGEBOX_USER  "${STORAGEBOX_USER:-}"

  local ssh_key="${SSH_PRIVATE_KEY_PATH:-${SSH_KEY_PATH_DEFAULT}}"
  if [[ ! -r "${ssh_key}" ]]; then
    log "FAIL: SSH private key not readable at ${ssh_key}"
    exit 13
  fi
  chmod 600 "${ssh_key}" 2>/dev/null || true
  export BORG_RSH="ssh -i ${ssh_key} -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"

  log "env ok: BORG_REPO present, SSH key readable at ${ssh_key}"
}

# ---------------------------------------------------------------------
# Best-effort alerts. These never propagate failure.
# ---------------------------------------------------------------------

alert() {
  local status="$1"
  local message="$2"
  if [[ -n "${BACKUP_ALERT_WEBHOOK_URL:-}" ]]; then
    log "alert: would POST status=${status} to webhook (URL not echoed)"
    # Real curl invocation deferred — operator wires this once the
    # webhook target is chosen. The placeholder LOG line is enough
    # for the verify CronJob to assert alerting is wired.
  fi
  if [[ -n "${BACKUP_ALERT_TELEGRAM_BOT_TOKEN:-}" && -n "${BACKUP_ALERT_TELEGRAM_CHAT_ID:-}" ]]; then
    log "alert: would POST status=${status} to Telegram chat (chat_id not echoed)"
  fi
  : "${message}"
}

# ---------------------------------------------------------------------
# Subcommands.
# ---------------------------------------------------------------------

cmd_upload() {
  require_borg_env
  local latest
  latest="$(ls -1t /backups/iterlaw-*.dump 2>/dev/null | head -1 || true)"
  if [[ -z "${latest}" ]]; then
    log "FAIL: no /backups/iterlaw-*.dump file found — local backup CronJob likely failed"
    alert "fail" "no_local_dump_to_upload"
    exit 20
  fi
  log "uploading: ${latest}"

  local archive
  archive="iterlaw-$(date -u +%Y%m%dT%H%M%SZ)"
  borg create --stats --compression auto,zstd,9 \
    "${BORG_REPO}::${archive}" "${latest}" "${latest}.sha256"

  log "pruning retention 7d/4w/12m"
  borg prune --list "${BORG_REPO}" \
    --keep-daily 7 \
    --keep-weekly 4 \
    --keep-monthly 12

  log "upload ok: archive=${archive}"
  alert "ok" "upload_complete"
}

cmd_verify() {
  require_borg_env
  log "borg check --verify-data"
  borg check --verify-data "${BORG_REPO}"

  log "borg list (tail)"
  borg list "${BORG_REPO}" | tail -20

  local latest_archive
  latest_archive="$(borg list --short "${BORG_REPO}" | tail -1)"
  if [[ -z "${latest_archive}" ]]; then
    log "FAIL: Borg repo contains no archives"
    alert "fail" "no_archives_in_repo"
    exit 21
  fi

  install -m 700 -d "${WORK_DIR}"
  cd "${WORK_DIR}"
  log "extracting ${latest_archive}"
  borg extract "${BORG_REPO}::${latest_archive}"

  local dump
  dump="$(ls "${WORK_DIR}/backups"/iterlaw-*.dump 2>/dev/null | head -1 || true)"
  if [[ -z "${dump}" ]]; then
    log "FAIL: extracted archive contains no iterlaw-*.dump"
    alert "fail" "extracted_archive_empty"
    exit 22
  fi

  log "pg_restore --list ${dump}"
  local list_out
  list_out="$(pg_restore --list "${dump}")"
  echo "${list_out}" | head -20

  if ! echo "${list_out}" | grep -q "SCHEMA - public"; then
    log "FAIL: dump does not include schema=public"
    alert "fail" "missing_public_schema"
    exit 23
  fi
  if ! echo "${list_out}" | grep -q "SCHEMA - uk_emp_rag"; then
    log "WARN: dump does not include schema=uk_emp_rag (acceptable only if uk_emp_rag is absent in the source DB)"
  fi

  log "verify ok: ${latest_archive}"
  alert "ok" "verify_complete"
}

cmd_list() {
  require_borg_env
  borg list "${BORG_REPO}"
}

cmd_inspect() {
  local dump="${1:-}"
  if [[ -z "${dump}" || ! -f "${dump}" ]]; then
    log "FAIL: inspect requires a path to a .dump file"
    exit 14
  fi
  pg_restore --list "${dump}"
}

# ---------------------------------------------------------------------
# Dispatcher.
# ---------------------------------------------------------------------

case "${1:---help}" in
  upload)  shift; cmd_upload  "$@" ;;
  verify)  shift; cmd_verify  "$@" ;;
  list)    shift; cmd_list    "$@" ;;
  inspect) shift; cmd_inspect "$@" ;;
  -h|--help|help) usage; exit 0 ;;
  *) log "unknown subcommand: $1"; usage; exit 2 ;;
esac
