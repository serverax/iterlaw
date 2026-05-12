#!/usr/bin/env bash
# verify-iterlaw-backup.sh — static checks on the IterLaw backup
# surface. Reports PASS / WARN / FAIL per check. Never opens a
# database connection, never contacts a Storage Box, never executes
# `kubectl apply`. Exits non-zero if any FAIL is recorded.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

RUNBOOK="${REPO_ROOT}/docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md"
CRONJOB="${REPO_ROOT}/k8s/iterlaw-data/backups/cronjob.yaml"
UPLOAD_CRONJOB="${REPO_ROOT}/k8s/iterlaw-data/backups/upload-cronjob.yaml"
UPLOAD_NETPOL="${REPO_ROOT}/k8s/iterlaw-data/backups/upload-networkpolicy.yaml"
VERIFY_CRONJOB="${REPO_ROOT}/k8s/iterlaw-data/backups/verify-cronjob.yaml"
BORG_SECRET="${REPO_ROOT}/k8s/iterlaw-data/secrets/iterlaw-backup-borg.example.yaml"
RESTORE_SCRIPT="${REPO_ROOT}/apps/legal-orchestrator/scripts/restore-from-borg.sh"

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
report() {
  printf "%-6s %s\n" "$1" "$2"
  case "$1" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  esac
}

# -----------------------------------------------------------------
# 1. Runbook present.
# -----------------------------------------------------------------
if [[ -f "${RUNBOOK}" ]]; then
  report "PASS" "runbook present: docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md"
else
  report "FAIL" "missing runbook: ${RUNBOOK}"
fi

# -----------------------------------------------------------------
# 2. Backup cronjob present + uses --format=custom + includes public.
# -----------------------------------------------------------------
if [[ -f "${CRONJOB}" ]]; then
  report "PASS" "backup cronjob present"
  if grep -q -- "--format=custom" "${CRONJOB}"; then
    report "PASS" "backup cronjob uses --format=custom"
  else
    report "FAIL" "backup cronjob does NOT use --format=custom"
  fi
  if grep -q -- "--schema=public" "${CRONJOB}"; then
    report "PASS" "backup cronjob includes --schema=public"
  else
    report "FAIL" "backup cronjob does NOT include --schema=public"
  fi
  if grep -q -- "--schema=uk_emp_rag" "${CRONJOB}"; then
    report "PASS" "backup cronjob includes --schema=uk_emp_rag (conditional)"
  else
    # Allowed — the cronjob conditionally adds uk_emp_rag based on a
    # schema-existence probe. But the literal string must appear so
    # the verifier can confirm the schema is in scope.
    report "FAIL" "backup cronjob does NOT mention uk_emp_rag — schema is required"
  fi
  if grep -qE "POSTGRES_PASSWORD|POSTGRES_USER" "${CRONJOB}"; then
    # The cronjob uses valueFrom: secretKeyRef — checking for the env
    # name, not a literal value. The literal value check below
    # ensures no plaintext.
    report "PASS" "backup cronjob references credentials via secretKeyRef"
  fi
  if grep -qE "(password|pwd):\s*['\"]?[A-Za-z0-9!@#%^&*()_+]{8,}" "${CRONJOB}"; then
    report "FAIL" "backup cronjob may contain a literal password — review"
  else
    report "PASS" "backup cronjob has no literal-looking password"
  fi
else
  report "FAIL" "missing backup cronjob"
fi

# -----------------------------------------------------------------
# 3. Borg secret example.
# -----------------------------------------------------------------
if [[ -f "${BORG_SECRET}" ]]; then
  report "PASS" "Borg example secret present"
  for placeholder in REPLACE_ME_BORG_REPO REPLACE_ME_BORG_PASSPHRASE \
                     REPLACE_ME_STORAGEBOX_HOST REPLACE_ME_STORAGEBOX_USER \
                     REPLACE_ME_SSH_PRIVATE_KEY; do
    if grep -q "${placeholder}" "${BORG_SECRET}"; then
      report "PASS" "  placeholder ${placeholder} present"
    else
      report "FAIL" "  placeholder ${placeholder} missing"
    fi
  done
  if grep -q "example-only" "${BORG_SECRET}"; then
    report "PASS" "  marked as example-only"
  else
    report "WARN" "  not annotated example-only"
  fi
  if grep -qE "^[[:space:]]*BORG_PASSPHRASE:[[:space:]]*[A-Za-z0-9]{16,}$" "${BORG_SECRET}"; then
    report "FAIL" "  BORG_PASSPHRASE looks like a real value, not REPLACE_ME"
  fi
else
  report "FAIL" "missing Borg example secret"
fi

# -----------------------------------------------------------------
# 4. Upload cronjob.
# -----------------------------------------------------------------
if [[ -f "${UPLOAD_CRONJOB}" ]]; then
  report "PASS" "upload cronjob present"
  if grep -q "borg create" "${UPLOAD_CRONJOB}"; then
    report "PASS" "upload cronjob calls borg create"
  else
    report "FAIL" "upload cronjob does not call borg create"
  fi
  if grep -q "readOnly: true" "${UPLOAD_CRONJOB}"; then
    report "PASS" "upload cronjob mounts backup PVC read-only"
  else
    report "WARN" "upload cronjob may not mount PVC read-only"
  fi
  if grep -q "iterlaw-backup-borg" "${UPLOAD_CRONJOB}"; then
    report "PASS" "upload cronjob references iterlaw-backup-borg secret"
  else
    report "FAIL" "upload cronjob does not reference iterlaw-backup-borg secret"
  fi
  if grep -qE "BORG_PASSPHRASE:\s*[A-Za-z0-9]{16,}" "${UPLOAD_CRONJOB}"; then
    report "FAIL" "upload cronjob carries a literal Borg passphrase"
  fi
else
  report "FAIL" "missing upload cronjob"
fi

# -----------------------------------------------------------------
# 5. Upload network policy (best-effort — limitations documented).
# -----------------------------------------------------------------
if [[ -f "${UPLOAD_NETPOL}" ]]; then
  report "PASS" "upload network policy present"
  if grep -q "policy-todo" "${UPLOAD_NETPOL}"; then
    report "WARN" "upload network policy carries a TODO marker — narrow the Storage Box CIDR before promotion"
  fi
else
  report "FAIL" "missing upload network policy"
fi

# -----------------------------------------------------------------
# 6. Verify cronjob.
# -----------------------------------------------------------------
if [[ -f "${VERIFY_CRONJOB}" ]]; then
  report "PASS" "verify cronjob present"
  if grep -qE "borg check|pg_restore --list" "${VERIFY_CRONJOB}"; then
    report "PASS" "verify cronjob runs borg check OR pg_restore --list"
  else
    report "FAIL" "verify cronjob does not run borg check / pg_restore --list"
  fi
  # Strip comments before checking, so the "does NOT call pg_restore
  # --dbname" sentence in the header doesn't false-positive.
  if grep -vE "^\s*#" "${VERIFY_CRONJOB}" | grep -q "pg_restore --dbname"; then
    report "FAIL" "verify cronjob calls pg_restore --dbname — must NEVER restore into a real DB"
  else
    report "PASS" "verify cronjob does not restore into a real database"
  fi
else
  report "FAIL" "missing verify cronjob"
fi

# -----------------------------------------------------------------
# 7. Restore script.
# -----------------------------------------------------------------
if [[ -f "${RESTORE_SCRIPT}" ]]; then
  report "PASS" "restore script present"
  if grep -q "FORCE_RESTORE" "${RESTORE_SCRIPT}"; then
    report "PASS" "restore script has FORCE_RESTORE guard"
  else
    report "FAIL" "restore script missing FORCE_RESTORE guard"
  fi
  if grep -q "iterlaw-postgres.iterlaw-data.svc.cluster.local" "${RESTORE_SCRIPT}"; then
    report "PASS" "restore script checks for production host fragment"
  else
    report "FAIL" "restore script does not check for production host fragment"
  fi
else
  report "FAIL" "missing restore script"
fi

# -----------------------------------------------------------------
# 8. Sweep all backup files for literal-looking secrets.
# -----------------------------------------------------------------
for f in "${CRONJOB}" "${UPLOAD_CRONJOB}" "${VERIFY_CRONJOB}" "${UPLOAD_NETPOL}" "${BORG_SECRET}"; do
  [[ -f "${f}" ]] || continue
  if grep -qE "ghp_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|github_pat_" "${f}"; then
    report "FAIL" "  literal-looking secret in $(basename "${f}")"
  fi
done

echo
if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "summary: FAIL (${FAIL_COUNT} fail, ${WARN_COUNT} warn, ${PASS_COUNT} pass)"
  exit 1
fi
if [[ "${WARN_COUNT}" -gt 0 ]]; then
  echo "summary: PARTIAL (${WARN_COUNT} warn, ${PASS_COUNT} pass)"
  exit 0
fi
echo "summary: PASS (${PASS_COUNT} pass)"
