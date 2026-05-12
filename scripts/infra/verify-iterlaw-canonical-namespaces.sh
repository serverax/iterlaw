#!/usr/bin/env bash
# verify-iterlaw-canonical-namespaces.sh — confirms that the IterLaw
# canonical multi-namespace architecture is in place (or at least that
# the repo never reverts to the disabled single-`iterlaw` draft).
#
# Reports: PASS / FAIL / NOT DEPLOYED / NOT EXECUTED. Never mutates the
# cluster. Never opens a database connection.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

report() { printf "%-12s %s\n" "$1" "$2"; }

# --------------------------------------------------------------------
# Repo-level checks (no cluster required).
# --------------------------------------------------------------------

# 1. No active manifest declares `namespace: iterlaw` (without the -ai
#    / -rag / -api / -monitoring / -security suffix). Disabled files
#    under k8s/iterlaw-disabled-master-order/ are exempt.
fail_active_iterlaw=0
if [[ -d "${REPO_ROOT}/k8s" ]]; then
  while IFS= read -r f; do
    # Skip files inside the disabled directory.
    case "${f}" in
      */k8s/iterlaw-disabled-master-order/*) continue ;;
    esac
    if grep -qE '^\s*namespace:\s*iterlaw\s*$' "${f}"; then
      report "FAIL" "active manifest still declares 'namespace: iterlaw': ${f}"
      fail_active_iterlaw=1
    fi
  done < <(find "${REPO_ROOT}/k8s" -type f -name '*.yaml' -print)
fi
if [[ "${fail_active_iterlaw}" -eq 0 ]]; then
  report "PASS" "no active k8s manifest declares 'namespace: iterlaw'"
fi

# 2. The disabled directory still exists (sanity — operators didn't
#    delete it accidentally, which would lose history).
if [[ -d "${REPO_ROOT}/k8s/iterlaw-disabled-master-order" ]]; then
  report "PASS" "k8s/iterlaw-disabled-master-order/ parked (with README)"
  if [[ ! -f "${REPO_ROOT}/k8s/iterlaw-disabled-master-order/README.md" ]]; then
    report "FAIL" "k8s/iterlaw-disabled-master-order/ missing README.md"
  fi
fi

# --------------------------------------------------------------------
# Cluster-level checks (best effort).
# --------------------------------------------------------------------

if ! command -v kubectl > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl not on PATH — skipping cluster checks"
  exit 0
fi
if ! kubectl version --client > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl client check failed — skipping cluster checks"
  exit 0
fi

# 3. Canonical namespaces present (one PASS per namespace).
for ns in iterlaw-ai iterlaw-rag iterlaw-api iterlaw-monitoring iterlaw-security; do
  if kubectl get ns "${ns}" > /dev/null 2>&1; then
    report "PASS" "namespace ${ns}"
  else
    report "NOT DEPLOYED" "namespace ${ns}"
  fi
done

# 4. The forbidden bare `iterlaw` namespace must NOT exist on the live
#    cluster. If it ever appears we want a loud fail.
if kubectl get ns iterlaw > /dev/null 2>&1; then
  report "FAIL" "bare 'iterlaw' namespace exists on cluster — should not (use the -ai/-rag/... split)"
else
  report "PASS" "no bare 'iterlaw' namespace on cluster"
fi
