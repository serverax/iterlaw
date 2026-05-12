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
  "iterlaw-ollama"
  "iterlaw-rag-api"
  "iterlaw-ingestion-worker"
  "iterlaw_knowledge"
  "iterlaw_user"
  "legal_questions"
  "/api/answer"
)

# `iterlaw-postgres` was previously forbidden. It is now the canonical
# workload name for the Postgres StatefulSet in iterlaw-data and is
# explicitly NOT in FORBIDDEN_NAMES.

# `ordinox-ai` is forbidden only as an IterLaw namespace value. Assert it
# is absent from any k8s manifest in either IterLaw namespace.
ORDINOX_FORBIDDEN_PATHS=(
  "${ROOT}/k8s/iterlaw"
  "${ROOT}/k8s/iterlaw-data"
)

# Banned env-var names in legal-orchestrator manifests.
BANNED_ORCHESTRATOR_VARS=(
  "OLLAMA_URL"
  "INTERNAL_MODEL_ENDPOINT"
  "CLAUDE_API_KEY"
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "MODEL_USED"
)

# ---------------------------------------------------------------------------
# File buckets.
# ---------------------------------------------------------------------------
# ACTIVE — strict. A forbidden name in any of these files is a FAIL.
ACTIVE_GLOBS=(
  "${ROOT}/k8s/iterlaw"                          # iterlaw-ai manifests
  "${ROOT}/k8s/iterlaw-data"                     # iterlaw-data manifests
  "${ROOT}/infra/iterlaw/environment-contract.md"
  "${ROOT}/infra/iterlaw/deployment-contract.md"
  "${ROOT}/infra/iterlaw/wasm-contract.md"
  "${ROOT}/infra/iterlaw/synthesis-llm-contract.md"
  "${ROOT}/infra/iterlaw/database-contract.md"
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
  # Files under k8s/iterlaw-disabled-* are intentionally parked and
  # are excluded from the active scan.
  for target in "${ACTIVE_GLOBS[@]}"; do
    if [[ -d "${target}" ]]; then
      find "${target}" -type f \( -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name '*.ts' -o -name '*.js' \) -print
    elif [[ -f "${target}" ]]; then
      printf '%s\n' "${target}"
    fi
  done | grep -v '/iterlaw-disabled-' || true
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

# `ordinox-ai` is forbidden only as an IterLaw *namespace value*. It IS
# permitted as part of a cross-namespace DNS reference such as
#   http://ollama.ordinox-ai.svc.cluster.local:11434
# (used by synthesis-worker to reach the existing internal Ollama).
for p in "${ORDINOX_FORBIDDEN_PATHS[@]}"; do
  [[ -d "${p}" ]] || continue
  if grep -RIn --binary-files=without-match -E '^\s*namespace:\s*ordinox-ai\b' "${p}" \
       > /tmp/iterlaw-ordinox.txt 2>/dev/null; then
    echo "FAIL 'namespace: ordinox-ai' must not appear in ${p}:"
    sed 's/^/  /' /tmp/iterlaw-ordinox.txt
    FAIL=1
  fi
done

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
# 3. Plaintext Secret manifests are forbidden under either k8s/iterlaw tree.
# ---------------------------------------------------------------------------
K8S_DIRS=(
  "${ROOT}/k8s/iterlaw"
  "${ROOT}/k8s/iterlaw-data"
)
for dir in "${K8S_DIRS[@]}"; do
  [[ -d "${dir}" ]] || continue
  while IFS= read -r f; do
    # `.example.yaml` files are placeholder templates that get
    # kubeseal-ed into real SealedSecrets before commit of any real
    # value. They MUST carry REPLACE_ME_* placeholders only (the
    # static-policy tests in src/tests/backupPolicy.test.ts and
    # src/tests/namespaceAndSchemaPolicy.test.ts assert this).
    case "$(basename "${f}")" in
      *.example.yaml) continue ;;
    esac
    if grep -q "^kind: Secret\$" "${f}"; then
      echo "FAIL plaintext Secret manifest: ${f}"
      FAIL=1
    fi
  done < <(find "${dir}" -type f -name '*.yaml' -print)
done

# ---------------------------------------------------------------------------
# 4. Every manifest (except Namespaces) must target its namespace correctly.
#    k8s/iterlaw/**       -> namespace: iterlaw-ai
#    k8s/iterlaw-data/**  -> namespace: iterlaw-data
# ---------------------------------------------------------------------------
check_namespace_for_dir() {
  local dir="$1" expected_ns="$2"
  [[ -d "${dir}" ]] || return 0
  while IFS= read -r f; do
    if [[ "$(basename "${f}")" == "namespace.yaml" ]]; then continue; fi
    if ! grep -q "namespace: ${expected_ns}" "${f}"; then
      echo "FAIL manifest missing namespace ${expected_ns}: ${f}"
      FAIL=1
    fi
  done < <(find "${dir}" -type f -name '*.yaml' -print)
}
check_namespace_for_dir "${ROOT}/k8s/iterlaw"      iterlaw-ai
check_namespace_for_dir "${ROOT}/k8s/iterlaw-data" iterlaw-data

# Cross-namespace contamination: nothing under k8s/iterlaw may declare
# `namespace: iterlaw-data`, and vice versa.
if [[ -d "${ROOT}/k8s/iterlaw" ]]; then
  while IFS= read -r f; do
    if grep -q "namespace: iterlaw-data" "${f}"; then
      echo "FAIL iterlaw-ai manifest declares iterlaw-data namespace: ${f}"
      FAIL=1
    fi
  done < <(find "${ROOT}/k8s/iterlaw" -type f -name '*.yaml' -print)
fi
if [[ -d "${ROOT}/k8s/iterlaw-data" ]]; then
  while IFS= read -r f; do
    if grep -q "namespace: iterlaw-ai" "${f}"; then
      echo "FAIL iterlaw-data manifest declares iterlaw-ai namespace: ${f}"
      FAIL=1
    fi
  done < <(find "${ROOT}/k8s/iterlaw-data" -type f -name '*.yaml' -print)
fi

# Web and synthesis-worker MUST NOT carry any DATABASE_URL / DB env reference.
DB_BANNED_PATHS=(
  "${ROOT}/k8s/iterlaw/web"
  "${ROOT}/k8s/iterlaw/synthesis-worker"
)
for p in "${DB_BANNED_PATHS[@]}"; do
  [[ -d "${p}" ]] || continue
  if grep -RIn --binary-files=without-match -E "DATABASE_URL|iterlaw-postgres|iterlaw-db-secret" "${p}" \
       > /tmp/iterlaw-db-leak.txt 2>/dev/null; then
    echo "FAIL database reference found outside legal-orchestrator: ${p}"
    sed 's/^/  /' /tmp/iterlaw-db-leak.txt
    FAIL=1
  fi
done

# ---------------------------------------------------------------------------
# 5. PostgreSQL must live only in iterlaw-data. Any `image: postgres:`
#    reference under k8s/iterlaw/ is a contract breach.
# ---------------------------------------------------------------------------
if [[ -d "${ROOT}/k8s/iterlaw" ]]; then
  if grep -RIn --binary-files=without-match -E '^\s*image:\s*postgres:' "${ROOT}/k8s/iterlaw" \
       > /tmp/iterlaw-pg-misplaced.txt 2>/dev/null; then
    echo "FAIL PostgreSQL image found outside iterlaw-data:"
    sed 's/^/  /' /tmp/iterlaw-pg-misplaced.txt
    FAIL=1
  fi
fi

# ---------------------------------------------------------------------------
# 6. Positive checks on the synthesis-worker ConfigMap.
#    The synthesis backend is short-term routed to the existing Ollama
#    service in ordinox-ai with three named UK-employment models.
# ---------------------------------------------------------------------------
SW_CM="${ROOT}/k8s/iterlaw/synthesis-worker/configmap.yaml"
if [[ -f "${SW_CM}" ]]; then
  REQUIRED_SW_KEYS=(
    "MODEL_MODE: internal"
    "INTERNAL_MODEL_ENDPOINT: http://ollama.ordinox-ai.svc.cluster.local:11434"
    "INTERNAL_MODEL_DEFAULT: uk-employment-qwen:latest"
    "INTERNAL_MODEL_DRAFTING: uk-employment-drafting:latest"
    "INTERNAL_MODEL_DOCUMENT: uk-employment-document:latest"
    "EXTERNAL_LLM_ENABLED: \"false\""
  )
  for k in "${REQUIRED_SW_KEYS[@]}"; do
    if ! grep -qF "${k}" "${SW_CM}"; then
      echo "FAIL synthesis-worker ConfigMap missing required entry: ${k}"
      FAIL=1
    fi
  done
fi

# ---------------------------------------------------------------------------
# 7. legal-orchestrator source must not import an LLM client.
# ---------------------------------------------------------------------------
LO_SRC="${ROOT}/apps/legal-orchestrator/src"
if [[ -d "${LO_SRC}" ]]; then
  if grep -RIn --binary-files=without-match -E "from ['\"](openai|@anthropic-ai/sdk|ollama|node-fetch|undici|axios)['\"]" "${LO_SRC}" \
       > /tmp/iterlaw-llm-import.txt 2>/dev/null; then
    echo "FAIL LLM client import in legal-orchestrator source:"
    sed 's/^/  /' /tmp/iterlaw-llm-import.txt
    FAIL=1
  fi
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
