#!/usr/bin/env bash
# deploy-iterlaw-k3s.sh — manual deploy of IterLaw to K3s.
#
# Pre-flight only by default. Pass `--apply` to actually run kubectl apply.
# CI must NEVER call this script with --apply.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPLY=0
for arg in "$@"; do
  case "${arg}" in
    --apply) APPLY=1 ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
  esac
done

echo "==> running static infra checks"
bash "${ROOT}/scripts/infra/verify-iterlaw-repo.sh"

echo "==> confirming kubectl context"
if ! command -v kubectl > /dev/null 2>&1; then
  echo "deploy-iterlaw-k3s: NOT EXECUTED — kubectl not found"
  exit 1
fi
kubectl config current-context

echo "==> ensuring namespace iterlaw-ai exists (pre-flight)"
if ! kubectl get ns iterlaw-ai > /dev/null 2>&1; then
  echo "namespace iterlaw-ai is NOT DEPLOYED"
fi

if [[ ${APPLY} -ne 1 ]]; then
  echo
  echo "Pre-flight complete. Re-run with --apply to apply manifests."
  exit 0
fi

# Apply order matches infra/iterlaw/deployment-contract.md.
APPLY_PATHS=(
  "${ROOT}/k8s/iterlaw/namespace.yaml"
  "${ROOT}/k8s/iterlaw/serviceaccount.yaml"
  "${ROOT}/k8s/iterlaw/resourcequotas.yaml"
  "${ROOT}/k8s/iterlaw/limitranges.yaml"
  "${ROOT}/k8s/iterlaw/secrets/"
  "${ROOT}/k8s/iterlaw/redis/"
  "${ROOT}/k8s/iterlaw/synthesis-worker/"
  "${ROOT}/k8s/iterlaw/legal-orchestrator/"
  "${ROOT}/k8s/iterlaw/wasm-rule-runner/"
  "${ROOT}/k8s/iterlaw/web/"
)

for p in "${APPLY_PATHS[@]}"; do
  if [[ -e "${p}" ]]; then
    echo "==> kubectl apply -f ${p}"
    kubectl apply -f "${p}"
  else
    echo "skip (not present): ${p}"
  fi
done

echo
echo "==> snapshot"
kubectl get all -n iterlaw-ai
