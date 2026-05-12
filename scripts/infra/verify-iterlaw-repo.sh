#!/usr/bin/env bash
# verify-iterlaw-repo.sh — static checks on the IterLaw infra surface.
#
# Two file classes are scanned with different rules:
#
#   ACTIVE  — runtime/config files that ship to production. Forbidden
#             names are NOT permitted to appear in any form. This is
#             the strict bucket.
#
#   POLICY  — contract docs, runbooks, and verifier scripts. Forbidden
#             names MAY appear here because these files exist precisely
#             to enumerate / reject them.
#
# The script also rejects, in the ACTIVE bucket:
#   * Banned env vars in legal-orchestrator (OLLAMA_URL, CLAUDE_API_KEY,
#     OPENAI_API_KEY).
#   * Plaintext `kind: Secret` manifests under k8s/iterlaw.
#   * Manifests under k8s/iterlaw missing `namespace: iterlaw-ai`.
#
# This script is read-only. It never writes, applies, or deploys.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ---------------------------------------------------------------------------
# Forbidden tokens. Mirrors infra/iterlaw/naming-contract.md.
# ---------------------------------------------------------------------------
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

# `ordinox-ai` is forbidden only as an IterLaw namespace value. We assert it
# is absent from k8s/iterlaw manifests (which target iterlaw-ai exclusively)
# rather than blanket-banning the word.
ORDINOX_FORBIDDEN_PATH="${ROOT}/k8s/iterlaw"

# Banned env-var names in legal-orchestrator manifests.
BANNED_ORCHESTRATOR_VARS=(
  "OLLAMA_URL"
  "CLAUDE_API_KEY"
  "OPENAI_API_KEY"
)

# ---------------------------------------------------------------------------
# File buckets.
# ---------------------------------------------------------------------------
# ACTIVE — strict. A forbidden name in any of these files is a FAIL.
ACTIVE_GLOBS=(
  "${ROOT}/k8s/iterlaw"                          # all manifests
  "${ROOT}/infra/iterlaw/environment-contract.md"
  "${ROOT}/infra/iterlaw/deployment-contract.md"
  "${ROOT}/infra/iterlaw/wasm-contract.md"
  "${ROOT}/infra/iterlaw/synthesis-llm-contract.md"
)

# POLICY — relaxed. Forbidden tokens are expected here as references.
POLICY_FILES=(
  "${ROOT}/infra/iterlaw/naming-contract.md"
  "${ROOT}/infra/iterlaw/secrets-contract.md"
  "${ROOT}/scripts/infra/verify-iterlaw-repo.sh"
  "${ROOT}/scripts/infra/verify-iterlaw-cluster.sh"
  # Plus all docs/infra/*.md, expanded below.
)
while IFS= read -r f; do
  POLICY_FILES+=("${f}")
done < <(find "${ROOT}/docs/infra" -maxdepth 1 -type f -name '*.md' 2>/dev/null || true)

FAIL=0

# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------
collect_active_files() {
  # Emit one absolute path per line for every ACTIVE file that exists.
  for target in "${ACTIVE_GLOBS[@]}"; do
    if [[ -d "${target}" ]]; then
      find "${target}" -type f \( -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name '*.ts' -o -name '*.js' \) -print
    elif [[ -f "${target}" ]]; then
      printf '%s\n' "${target}"
    fi
  done
}

# ---------------------------------------------------------------------------
# 1. Strict forbidden-name scan against ACTIVE files only.
# ---------------------------------------------------------------------------
mapfile -t ACTIVE_FILES < <(collect_active_files | sort -u)

if [[ ${#ACTIVE_FILES[@]} -eq 0 ]]; then
  echo "verify-iterlaw-repo: NOT EXECUTED — no active files present yet"
  exit 0
fi

echo "verify-iterlaw-repo: scanning ${#ACTIVE_FILES[@]} active file(s)"

for name in "${FORBIDDEN_NAMES[@]}"; do
  if grep -In --binary-files=without-match -F "${name}" "${ACTIVE_FILES[@]}" \
       > /tmp/iterlaw-active-hits.txt 2>/dev/null; then
    echo "FAIL forbidden token '${name}' found in active file(s):"
    sed 's/^/  /' /tmp/iterlaw-active-hits.txt
    FAIL=1
  fi
done

# `ordinox-ai` may not appear as a namespace value in k8s/iterlaw manifests.
if [[ -d "${ORDINOX_FORBIDDEN_PATH}" ]]; then
  if grep -RIn --binary-files=without-match -F "ordinox-ai" "${ORDINOX_FORBIDDEN_PATH}" \
       > /tmp/iterlaw-ordinox.txt 2>/dev/null; then
    echo "FAIL 'ordinox-ai' must not appear in k8s/iterlaw manifests:"
    sed 's/^/  /' /tmp/iterlaw-ordinox.txt
    FAIL=1
  fi
fi

# ---------------------------------------------------------------------------
# 2. Banned env vars in legal-orchestrator manifests.
# ---------------------------------------------------------------------------
if [[ -d "${ROOT}/k8s/iterlaw/legal-orchestrator" ]]; then
  for v in "${BANNED_ORCHESTRATOR_VARS[@]}"; do
    if grep -RIn --binary-files=without-match -F "${v}" "${ROOT}/k8s/iterlaw/legal-orchestrator" \
         > /tmp/iterlaw-banned-env.txt 2>/dev/null; then
      echo "FAIL banned env in legal-orchestrator manifest: ${v}"
      sed 's/^/  /' /tmp/iterlaw-banned-env.txt
      FAIL=1
    fi
  done
fi

# ---------------------------------------------------------------------------
# 3. Plaintext Secret manifests are forbidden under k8s/iterlaw.
# ---------------------------------------------------------------------------
if [[ -d "${ROOT}/k8s/iterlaw" ]]; then
  while IFS= read -r f; do
    if grep -q "^kind: Secret\$" "${f}"; then
      echo "FAIL plaintext Secret manifest: ${f}"
      FAIL=1
    fi
  done < <(find "${ROOT}/k8s/iterlaw" -type f -name '*.yaml' -print)

  # 4. Every k8s/iterlaw manifest (except Namespace) must target iterlaw-ai.
  while IFS= read -r f; do
    if [[ "$(basename "${f}")" == "namespace.yaml" ]]; then continue; fi
    if ! grep -q "namespace: iterlaw-ai" "${f}"; then
      echo "FAIL manifest missing namespace iterlaw-ai: ${f}"
      FAIL=1
    fi
  done < <(find "${ROOT}/k8s/iterlaw" -type f -name '*.yaml' -print)
fi

# ---------------------------------------------------------------------------
# 5. Policy files — diagnostic only. We surface a note but never fail here.
# ---------------------------------------------------------------------------
POLICY_REFS=0
for f in "${POLICY_FILES[@]}"; do
  [[ -f "${f}" ]] || continue
  for name in "${FORBIDDEN_NAMES[@]}"; do
    if grep -qF "${name}" "${f}"; then
      POLICY_REFS=$((POLICY_REFS + 1))
      break
    fi
  done
done
echo "verify-iterlaw-repo: policy/docs references to forbidden names: ${POLICY_REFS} file(s) (informational, not a failure)"

if [[ ${FAIL} -ne 0 ]]; then
  echo "verify-iterlaw-repo: FAIL"
  exit 1
fi

echo "verify-iterlaw-repo: PASS"
