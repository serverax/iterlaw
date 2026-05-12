#!/usr/bin/env bash
# verify-iterlaw-v3-safety.sh — Sprint 11 hardening.
#
# Reads only. Never executes, deploys, applies, or contacts a DB.
#
# Each check is scoped to the surface where the rule MUST hold.
# Legacy-marker text inside historical docs / parked manifests /
# `.github/workflows-disabled/` is intentionally NOT scanned — those
# locations carry "Legacy name: RightsNow" markers and runbook steps
# describing manual operator actions, both of which are allowed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAIL=0

# Active-source scope: directories where RightsNow / external LLM /
# performance-claim / unsafe-architecture text must never appear.
ACTIVE_SRC_DIRS=(
  "${ROOT}/apps/legal-orchestrator/src"
  "${ROOT}/apps/web/app"
  "${ROOT}/apps/web/lib"
  "${ROOT}/apps/web/types"
  "${ROOT}/apps/web/scripts"
  "${ROOT}/apps/ai-orchestrator/src"
  "${ROOT}/api/src"
  "${ROOT}/backend/src"
  "${ROOT}/backend/server.ts"
  "${ROOT}/packages/shared/src"
  "${ROOT}/packages/legal-core/src"
)

# Active-plan scope: planning + status docs where performance claims
# and unsafe architecture wording must not appear.
ACTIVE_PLAN_DOCS=(
  "${ROOT}/ITERLAW_PROJECT_STATUS.md"
  "${ROOT}/docs/iterlaw"
  "${ROOT}/docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md"
)

# Source-only remediation scope: directories where automatic-remediation
# tokens must not appear. EXCLUDES docs/, runbooks, and parked
# manifests — those legitimately describe manual operator commands.
SOURCE_ONLY_REMEDIATION_DIRS=(
  "${ROOT}/apps/legal-orchestrator/src"
  "${ROOT}/apps/web/app"
  "${ROOT}/apps/web/lib"
  "${ROOT}/api/src"
  "${ROOT}/backend/src"
  "${ROOT}/packages/shared/src"
  "${ROOT}/packages/legal-core/src"
)

# Helper — grep -RIn with consistent excludes. Returns 0 if matches
# found (we INVERT to a FAIL); 1 if none.
exists_in() {
  local pattern="$1"
  shift
  for target in "$@"; do
    [[ -e "${target}" ]] || continue
    if grep -RInE --binary-files=without-match \
        --exclude-dir=node_modules --exclude-dir=.git \
        --exclude-dir=dist --exclude-dir=build \
        "${pattern}" "${target}" > /tmp/iterlaw-v3-hit.txt 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------
# 1. No legacy project name in ACTIVE source.
# ---------------------------------------------------------------------
echo "[IterLaw v3 Safety] Checking no legacy project name in active source..."
if exists_in '\bRightsNow\b' "${ACTIVE_SRC_DIRS[@]}"; then
  echo "FAIL: Forbidden legacy name 'RightsNow' found in active source:"
  sed 's/^/  /' /tmp/iterlaw-v3-hit.txt
  FAIL=1
fi

# ---------------------------------------------------------------------
# 2. No external LLM provider hostnames in legal-orchestrator source.
# ---------------------------------------------------------------------
echo "[IterLaw v3 Safety] Checking no external LLM provider calls..."
if exists_in 'api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com' \
   "${ROOT}/apps/legal-orchestrator/src"; then
  echo "FAIL: External LLM provider URL found in legal-orchestrator source:"
  sed 's/^/  /' /tmp/iterlaw-v3-hit.txt
  FAIL=1
fi

# ---------------------------------------------------------------------
# 3. No unverified LLM performance / RAG-killer claims in active plans
#    or source. The benchmark plan is exempt because it explicitly
#    states that no claim is allowed until measured.
# ---------------------------------------------------------------------
echo "[IterLaw v3 Safety] Checking no unverified LLM performance claims..."
PLAN_TARGETS=()
for t in "${ACTIVE_PLAN_DOCS[@]}"; do
  [[ -e "${t}" ]] || continue
  PLAN_TARGETS+=("${t}")
done
for t in "${ACTIVE_SRC_DIRS[@]}"; do
  [[ -e "${t}" ]] || continue
  PLAN_TARGETS+=("${t}")
done

# Policy / refusal files are excluded — they state the rule ("no
# sub-second claims accepted until measured"), which would
# false-positive on a bare-keyword scan. The verifier is about
# unverified positive claims, not policy denials.
if grep -RInE --binary-files=without-match \
    --exclude-dir=node_modules --exclude-dir=.git \
    --exclude-dir=dist --exclude-dir=build \
    --exclude="ITERLAW_PROJECT_STATUS.md" \
    --exclude="SPRINT_11_LOCAL_LLM_BENCHMARK_PLAN.md" \
    --exclude="SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md" \
    --exclude="verify-iterlaw-v3-safety.sh" \
    'sub-second|under 10ms|fastest in the UK|reducing hallucination by 99%|RAG killer|RAG Killer' \
    "${PLAN_TARGETS[@]}" > /tmp/iterlaw-v3-hit.txt 2>/dev/null; then
  # Drop any line that is itself a policy / refusal statement.
  if grep -vE '^[^:]+:[0-9]+:\s*(No |Do not |Never |Must not |# )' \
       /tmp/iterlaw-v3-hit.txt > /tmp/iterlaw-v3-hit-filtered.txt; then
    if [[ -s /tmp/iterlaw-v3-hit-filtered.txt ]]; then
      echo "FAIL: Unverified performance or unsafe architecture claim found:"
      sed 's/^/  /' /tmp/iterlaw-v3-hit-filtered.txt
      FAIL=1
    fi
  fi
fi

# ---------------------------------------------------------------------
# 4. No "TensorRT on i7-8700" combination — that pairing is invalid
#    (TensorRT needs an NVIDIA GPU + CUDA). Scope: active plans + src.
# ---------------------------------------------------------------------
echo "[IterLaw v3 Safety] Checking no TensorRT CPU-only claim..."
if grep -RInE --binary-files=without-match \
    --exclude-dir=node_modules --exclude-dir=.git \
    --exclude-dir=dist --exclude-dir=build \
    'TensorRT[^\n]*i7-8700|i7-8700[^\n]*TensorRT' \
    "${PLAN_TARGETS[@]}" > /tmp/iterlaw-v3-hit.txt 2>/dev/null; then
  echo "FAIL: TensorRT pairing with CPU-only i7-8700:"
  sed 's/^/  /' /tmp/iterlaw-v3-hit.txt
  FAIL=1
fi

# ---------------------------------------------------------------------
# 5. No "bake statute / knows the law instantly" wording — implies
#    the model answers from memory, which contradicts the citation
#    gate. Scope: active plans + src.
# ---------------------------------------------------------------------
echo "[IterLaw v3 Safety] Checking no baked legal source wording..."
if grep -RInE --binary-files=without-match \
    --exclude-dir=node_modules --exclude-dir=.git \
    --exclude-dir=dist --exclude-dir=build \
    'bake[ds]?[^\n]*statute|baked[^\n]*law|knows the law instantly' \
    "${PLAN_TARGETS[@]}" > /tmp/iterlaw-v3-hit.txt 2>/dev/null; then
  echo "FAIL: Unsafe legal-source caching wording:"
  sed 's/^/  /' /tmp/iterlaw-v3-hit.txt
  FAIL=1
fi

# ---------------------------------------------------------------------
# 6. No automatic-remediation tokens in *source* code. Runbook docs
#    legitimately describe manual operator commands; those are NOT
#    scanned.
# ---------------------------------------------------------------------
echo "[IterLaw v3 Safety] Checking no automatic secret remediation in source..."
if exists_in 'rotate[^\n]*secret|kubectl drain|kubectl delete|isolation mode' \
   "${SOURCE_ONLY_REMEDIATION_DIRS[@]}"; then
  echo "FAIL: Unsafe automatic-remediation wording or command in source:"
  sed 's/^/  /' /tmp/iterlaw-v3-hit.txt
  FAIL=1
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo "FAIL: IterLaw v3 safety checks did not pass."
  exit 1
fi

echo "PASS: IterLaw v3 safety checks completed."
