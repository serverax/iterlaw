#!/usr/bin/env bash
# restore-from-borg.sh — manual, supervised restore helper.
#
# Three modes (one per invocation):
#
#   list                List archives in the Borg repository.
#   extract [archive]   Extract an archive into /tmp/iterlaw-restore.
#                        Default: the most recent archive.
#   inspect <archive>   Run `pg_restore --list` against the extracted
#                        dump and print the TOC.
#   restore <dump-path> --target "$DATABASE_URL"
#                        Run `pg_restore --dbname "$DATABASE_URL" <dump>`.
#                        Refuses to run if the target URL contains
#                        `iterlaw-postgres.iterlaw-data.svc.cluster.local`
#                        (the production DSN) unless FORCE_RESTORE=true
#                        is set in the environment.
#
# Hard rules:
#   * No real credentials in this file. The script reads BORG_REPO /
#     BORG_PASSPHRASE / BORG_RSH from the environment.
#   * The script never writes to the production database without
#     FORCE_RESTORE=true. The default behaviour is to print the
#     intended pg_restore command and exit non-zero.
#   * `set -euo pipefail` everywhere. A failed step never silently
#     produces a partial restore.
#   * No HTTP. No LLM. No secrets created.

set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  $0 list
  $0 extract [archive_name]
  $0 inspect <dump_path>
  $0 restore <dump_path> --target "<postgres_dsn>"

Environment required for list / extract:
  BORG_REPO, BORG_PASSPHRASE, BORG_RSH (or SSH keys configured)

Environment required for restore:
  --target supplies the destination DSN. The script REFUSES to point
  at the production iterlaw-postgres host unless FORCE_RESTORE=true.
USAGE
}

PRODUCTION_HOST_FRAGMENT="iterlaw-postgres.iterlaw-data.svc.cluster.local"

cmd="${1:-}"
shift || true

case "${cmd}" in
  "" | -h | --help)
    usage
    exit 0
    ;;

  list)
    : "${BORG_REPO:?BORG_REPO env var required}"
    : "${BORG_PASSPHRASE:?BORG_PASSPHRASE env var required}"
    borg list "${BORG_REPO}"
    ;;

  extract)
    : "${BORG_REPO:?BORG_REPO env var required}"
    : "${BORG_PASSPHRASE:?BORG_PASSPHRASE env var required}"
    target_dir="/tmp/iterlaw-restore"
    mkdir -p "${target_dir}"
    archive="${1:-}"
    if [[ -z "${archive}" ]]; then
      archive="$(borg list --short "${BORG_REPO}" | tail -1)"
      echo "no archive given; using latest: ${archive}"
    fi
    cd "${target_dir}"
    borg extract --list "${BORG_REPO}::${archive}"
    echo
    echo "extracted to: ${target_dir}"
    echo "look for dumps under: ${target_dir}/backups/iterlaw-*.dump"
    ;;

  inspect)
    dump="${1:-}"
    if [[ -z "${dump}" || ! -f "${dump}" ]]; then
      echo "FAIL: pg_restore --list needs a path to a .dump file"
      usage
      exit 2
    fi
    pg_restore --list "${dump}"
    ;;

  restore)
    dump="${1:-}"
    shift || true
    target=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --target)
          target="${2:-}"
          shift 2
          ;;
        *)
          echo "unknown flag: $1"
          usage
          exit 2
          ;;
      esac
    done

    if [[ -z "${dump}" || ! -f "${dump}" ]]; then
      echo "FAIL: restore needs a path to a .dump file"
      usage
      exit 2
    fi
    if [[ -z "${target}" ]]; then
      echo "FAIL: restore needs --target <postgres_dsn>"
      usage
      exit 2
    fi

    # Production guard. We do NOT print the DSN — it may carry
    # credentials. We just check for the production host fragment.
    if echo "${target}" | grep -q "${PRODUCTION_HOST_FRAGMENT}"; then
      if [[ "${FORCE_RESTORE:-false}" != "true" ]]; then
        cat >&2 <<MSG

REFUSED: target DSN points at the production iterlaw-postgres host.

This script will NOT restore into the live production database without
explicit operator override. To proceed:

  1. Confirm the production database is already offline / draining.
  2. Take a fresh local backup of the current production state.
  3. Re-run with: FORCE_RESTORE=true $0 restore <dump> --target <dsn>

DSN host fragment matched: ${PRODUCTION_HOST_FRAGMENT}

MSG
        exit 10
      fi
      echo "WARN: FORCE_RESTORE=true and target is production — proceeding."
    fi

    echo "==> pg_restore --no-owner --no-privileges --clean --if-exists --dbname <target> ${dump}"
    pg_restore --no-owner --no-privileges --clean --if-exists \
      --dbname "${target}" "${dump}"
    echo "restore complete."
    ;;

  *)
    echo "unknown command: ${cmd}"
    usage
    exit 2
    ;;
esac
