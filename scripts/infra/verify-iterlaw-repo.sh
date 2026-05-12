#!/usr/bin/env bash
set -euo pipefail

echo "=== IterLaw repo infra verification ==="

FAIL=0

strict_paths=(
  "k8s/iterlaw"
  "k8s/iterlaw-data"
  "infra/iterlaw/environment-contract.md"
  "infra/iterlaw/deployment-contract.md"
)

for p in "${strict_paths[@]}"; do
  [ -e "$p" ] || continue
  if grep -RniE 'rightsnow|iterlaw-rag-api|iterlaw-ingestion-worker|iterlaw-ollama|iterlaw_knowledge|legal_questions|/api/answer|CLAUDE_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|OLLAMA_URL' "$p" 2>/dev/null; then
    echo "FAIL: forbidden active config found in $p"
    FAIL=1
  fi
done

if grep -RniE 'INTERNAL_MODEL_ENDPOINT|MODEL_USED|OLLAMA_URL|CLAUDE_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY' apps/legal-orchestrator 2>/dev/null; then
  echo "FAIL: legal-orchestrator contains model/LLM config"
  FAIL=1
else
  echo "PASS: legal-orchestrator has no direct LLM config"
fi

if grep -Rni 'namespace: ordinox-ai' k8s/iterlaw k8s/iterlaw-data 2>/dev/null; then
  echo "FAIL: IterLaw manifests use ordinox-ai namespace"
  FAIL=1
else
  echo "PASS: IterLaw manifests do not use ordinox-ai namespace"
fi

if grep -Rni 'kind: Secret' k8s/iterlaw k8s/iterlaw-data 2>/dev/null; then
  echo "FAIL: plaintext Kubernetes Secret manifest found"
  FAIL=1
else
  echo "PASS: no plaintext Secret manifests found"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "Verification failed."
  exit 1
fi

echo "PASS: IterLaw repo infra verification complete"
