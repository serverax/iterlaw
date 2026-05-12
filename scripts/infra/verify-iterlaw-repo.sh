#!/usr/bin/env bash
# verify-iterlaw-repo.sh — static checks on the IterLaw infra surface.
#
# Exits non-zero if any of the following is true in the *new* infra tree
# (infra/iterlaw, k8s/iterlaw, scripts/infra, docs/infra):
#   1. A forbidden name appears.
#   2. A manifest references a banned env var in legal-orchestrator.
#   3. A plaintext Kubernetes Secret manifest exists.
#   4. A manifest is missing `namespace: iterlaw-ai`.
#
# This script reads only. It never writes, applies, or deploys.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIRS=(
  "${ROOT}/infra/iterlaw"
  "${ROOT}/k8s/iterlaw"
  "${ROOT}/scripts/infra"
  "${ROOT}/docs/infra"
)

# These names are reserved or come from retired ancestors. They must not
# appear anywhere in the IterLaw infra tree. The list mirrors
# infra/iterlaw/naming-contract.md.
FORBIDDEN_NAMES=(
  "rightsnow"
  "iterlaw-postgres"
  "iterlaw-ollama"
  "iterlaw-rag-api"
  "iterlaw-ingestion-worker"
  "iterlaw_knowledge"
  "iterlaw_user"
  "legal_questions"
  "/api/answer"
)

# Banned env vars in legal-orchestrator manifests.
BANNED_ORCHESTRATOR_VARS=(
  "OLLAMA_URL"
  "CLAUDE_API_KEY"
  "OPENAI_API_KEY"
)

EXISTING_DIRS=()
for d in "${INFRA_DIRS[@]}"; do
  if [[ -d "${d}" ]]; then
    EXISTING_DIRS+=("${d}")
  fi
done

if [[ ${#EXISTING_DIRS[@]} -eq 0 ]]; then
  echo "verify-iterlaw-repo: NOT EXECUTED — no infra dirs present yet"
  exit 0
fi

FAIL=0

echo "verify-iterlaw-repo: scanning ${EXISTING_DIRS[*]}"

# Files that legitimately enumerate the forbidden list (the contract doc,
# this script, and the cluster-side verifier that checks for stale workloads).
EXCLUDE_BASENAMES=(
  "naming-contract.md"
  "verify-iterlaw-repo.sh"
  "verify-iterlaw-cluster.sh"
  "ITERLAW_K3S_DEPLOYMENT.md"
)

is_excluded() {
  local f="$1"
  for ex in "${EXCLUDE_BASENAMES[@]}"; do
    if [[ "$(basename "${f}")" == "${ex}" ]]; then return 0; fi
  done
  return 1
}

for name in "${FORBIDDEN_NAMES[@]}"; do
  grep -RIln --binary-files=without-match -F "${name}" "${EXISTING_DIRS[@]}" 2>/dev/null \
    > /tmp/iterlaw-forbidden-files.txt || true
  if [[ -s /tmp/iterlaw-forbidden-files.txt ]]; then
    while IFS= read -r f; do
      if is_excluded "${f}"; then continue; fi
      echo "FAIL forbidden name found in: ${f} (token: ${name})"
      FAIL=1
    done < /tmp/iterlaw-forbidden-files.txt
  fi
done

if [[ -d "${ROOT}/k8s/iterlaw/legal-orchestrator" ]]; then
  for v in "${BANNED_ORCHESTRATOR_VARS[@]}"; do
    if grep -RIn --binary-files=without-match -F "${v}" "${ROOT}/k8s/iterlaw/legal-orchestrator" > /tmp/iterlaw-banned-env.txt 2>/dev/null; then
      echo "FAIL banned env in legal-orchestrator: ${v}"
      sed 's/^/  /' /tmp/iterlaw-banned-env.txt
      FAIL=1
    fi
  done
fi

# Reject plaintext Secret manifests in k8s/iterlaw. SealedSecret is allowed.
if [[ -d "${ROOT}/k8s/iterlaw" ]]; then
  while IFS= read -r f; do
    if grep -q "^kind: Secret\$" "${f}"; then
      echo "FAIL plaintext Secret manifest: ${f}"
      FAIL=1
    fi
  done < <(find "${ROOT}/k8s/iterlaw" -type f -name '*.yaml' -print)

  # Every k8s manifest in k8s/iterlaw must target the iterlaw-ai namespace.
  while IFS= read -r f; do
    # Skip the Namespace definition itself.
    if [[ "$(basename "${f}")" == "namespace.yaml" ]]; then continue; fi
    if ! grep -q "namespace: iterlaw-ai" "${f}"; then
      echo "FAIL manifest missing namespace iterlaw-ai: ${f}"
      FAIL=1
    fi
  done < <(find "${ROOT}/k8s/iterlaw" -type f -name '*.yaml' -print)
fi

if [[ ${FAIL} -ne 0 ]]; then
  echo "verify-iterlaw-repo: FAIL"
  exit 1
fi

echo "verify-iterlaw-repo: PASS"
