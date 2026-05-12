#!/usr/bin/env bash
# create-backup-borg-sealedsecret-template.sh
#
# Generate a RAW Kubernetes Secret YAML for the Borg + Hetzner Storage
# Box credentials, ready to be piped through `kubeseal`. Writes to
# stdout by default — only to disk when `--output <path>` is passed,
# and even then prints a loud warning.
#
# Refuses to emit anything if:
#   * any required env var is unset or empty,
#   * any required env var still carries a REPLACE_ME placeholder.
#
# Usage:
#   BORG_REPO=... BORG_PASSPHRASE=... STORAGEBOX_HOST=... \
#   STORAGEBOX_USER=... SSH_PRIVATE_KEY="$(cat ~/.ssh/id_storagebox)" \
#     bash scripts/infra/create-backup-borg-sealedsecret-template.sh
#
#   ... | kubeseal --controller-namespace kube-system \
#                  --controller-name sealed-secrets-controller \
#                  --format yaml \
#       > k8s/iterlaw-data/secrets/iterlaw-backup-borg-sealedsecret.yaml
#
#   bash scripts/infra/create-backup-borg-sealedsecret-template.sh --kubeseal
#     (runs kubeseal inline if it is on PATH; otherwise reports
#      KUBESEAL_NOT_AVAILABLE and exits non-zero)

set -euo pipefail

NAMESPACE="iterlaw-data"
SECRET_NAME="iterlaw-backup-borg"
OUTPUT=""
RUN_KUBESEAL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT="${2:?--output requires a path}"; shift 2 ;;
    --kubeseal) RUN_KUBESEAL=1; shift ;;
    -h|--help)
      sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown flag: $1"; exit 2 ;;
  esac
done

require_env() {
  local name="$1" value="${!1:-}"
  case "${value}" in
    "" )
      echo "FAIL: required env ${name} is empty — refusing to emit Secret"
      exit 11
      ;;
    REPLACE_ME*)
      echo "FAIL: required env ${name} still set to a REPLACE_ME placeholder"
      exit 12
      ;;
  esac
}

require_env BORG_REPO
require_env BORG_PASSPHRASE
require_env STORAGEBOX_HOST
require_env STORAGEBOX_USER
require_env SSH_PRIVATE_KEY

# Optional alerting placeholders. NOT required.
: "${BACKUP_ALERT_WEBHOOK_URL:=}"
: "${BACKUP_ALERT_TELEGRAM_BOT_TOKEN:=}"
: "${BACKUP_ALERT_TELEGRAM_CHAT_ID:=}"
: "${SSH_KNOWN_HOSTS:=}"

# Build the YAML in-memory. SSH_PRIVATE_KEY is multi-line; we use the
# YAML literal-block style (`|`) and indent every line by 4 spaces.
indent_block() {
  # Read stdin, prepend 4 spaces per line.
  awk '{ print "    " $0 }'
}

YAML="$(cat <<HEADER
apiVersion: v1
kind: Secret
metadata:
  name: ${SECRET_NAME}
  namespace: ${NAMESPACE}
  annotations:
    iterlaw.io/origin: "create-backup-borg-sealedsecret-template.sh"
    iterlaw.io/raw: "true"
type: Opaque
stringData:
  BORG_REPO: |
$(printf '%s' "${BORG_REPO}" | indent_block)
  BORG_PASSPHRASE: |
$(printf '%s' "${BORG_PASSPHRASE}" | indent_block)
  STORAGEBOX_HOST: |
$(printf '%s' "${STORAGEBOX_HOST}" | indent_block)
  STORAGEBOX_USER: |
$(printf '%s' "${STORAGEBOX_USER}" | indent_block)
  SSH_PRIVATE_KEY: |
$(printf '%s' "${SSH_PRIVATE_KEY}" | indent_block)
  SSH_KNOWN_HOSTS: |
$(printf '%s' "${SSH_KNOWN_HOSTS}" | indent_block)
  BACKUP_ALERT_WEBHOOK_URL: |
$(printf '%s' "${BACKUP_ALERT_WEBHOOK_URL}" | indent_block)
  BACKUP_ALERT_TELEGRAM_BOT_TOKEN: |
$(printf '%s' "${BACKUP_ALERT_TELEGRAM_BOT_TOKEN}" | indent_block)
  BACKUP_ALERT_TELEGRAM_CHAT_ID: |
$(printf '%s' "${BACKUP_ALERT_TELEGRAM_CHAT_ID}" | indent_block)
HEADER
)"

if [[ "${RUN_KUBESEAL}" -eq 1 ]]; then
  if ! command -v kubeseal > /dev/null 2>&1; then
    echo "KUBESEAL_NOT_AVAILABLE — install kubeseal or run without --kubeseal and pipe manually"
    exit 3
  fi
  echo >&2 "==> piping raw Secret through kubeseal"
  if [[ -n "${OUTPUT}" ]]; then
    echo >&2 "WARNING: writing sealed output to ${OUTPUT}. Verify it is `kind: SealedSecret` before commit."
    printf '%s\n' "${YAML}" \
      | kubeseal \
          --controller-namespace kube-system \
          --controller-name sealed-secrets-controller \
          --format yaml \
      > "${OUTPUT}"
  else
    printf '%s\n' "${YAML}" \
      | kubeseal \
          --controller-namespace kube-system \
          --controller-name sealed-secrets-controller \
          --format yaml
  fi
  exit 0
fi

if [[ -n "${OUTPUT}" ]]; then
  echo >&2 ""
  echo >&2 "============================================================"
  echo >&2 "WARNING: writing RAW Secret YAML to ${OUTPUT}"
  echo >&2 "  This file contains plaintext credentials. DO NOT COMMIT."
  echo >&2 "  Pipe through kubeseal, commit only the sealed output,"
  echo >&2 "  then 'shred -u ${OUTPUT}'."
  echo >&2 "============================================================"
  echo >&2 ""
  printf '%s\n' "${YAML}" > "${OUTPUT}"
  exit 0
fi

# Default path: stdout, with a stderr reminder.
echo >&2 ""
echo >&2 "Raw Secret YAML written to stdout."
echo >&2 "Pipe it through kubeseal or run again with --kubeseal."
echo >&2 "DO NOT redirect to a file under git unless you intend to seal it next."
echo >&2 ""
printf '%s\n' "${YAML}"
