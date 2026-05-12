#!/usr/bin/env bash
# rollback-iterlaw-k3s.sh — `kubectl rollout undo` for the IterLaw deployments.
#
# Does not touch the synthesis-redis StatefulSet — Redis rollback is manual.

set -euo pipefail

NS="iterlaw-ai"
DEPLOYMENTS=(
  "legal-orchestrator"
  "synthesis-worker"
  "iterlaw-web"
)

if ! command -v kubectl > /dev/null 2>&1; then
  echo "rollback-iterlaw-k3s: NOT EXECUTED — kubectl not found"
  exit 1
fi

for d in "${DEPLOYMENTS[@]}"; do
  if kubectl -n "${NS}" get deploy "${d}" > /dev/null 2>&1; then
    echo "==> rolling back ${d}"
    kubectl -n "${NS}" rollout undo deploy/"${d}"
    kubectl -n "${NS}" rollout status deploy/"${d}"
  else
    echo "skip (not deployed): ${d}"
  fi
done
