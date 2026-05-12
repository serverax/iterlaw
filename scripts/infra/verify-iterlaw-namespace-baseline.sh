#!/usr/bin/env bash
set -euo pipefail

echo "=== IterLaw namespace baseline verification ==="

FAIL=0

echo
echo "Checking required files..."

required_files=(
  "k8s/iterlaw/namespace.yaml"
  "k8s/iterlaw-data/namespace.yaml"
  "k8s/iterlaw/serviceaccount.yaml"
  "k8s/iterlaw-data/serviceaccount.yaml"
  "k8s/iterlaw/legal-orchestrator/configmap.yaml"
  "k8s/iterlaw/synthesis-worker/configmap.yaml"
  "k8s/iterlaw/web/configmap.yaml"
  "k8s/iterlaw/wasm-rule-runner/configmap.yaml"
  "k8s/iterlaw/redis/service.yaml"
  "k8s/iterlaw/redis/statefulset.yaml"
  "k8s/iterlaw-data/postgres/configmap.yaml"
  "k8s/iterlaw-data/postgres/service.yaml"
  "k8s/iterlaw-data/postgres/statefulset.yaml"
  "scripts/infra/apply-iterlaw-namespace-baseline.sh"
)

for f in "${required_files[@]}"; do
  if [ -f "$f" ]; then
    echo "PASS: $f"
  else
    echo "FAIL: missing $f"
    FAIL=1
  fi
done

echo
echo "Checking forbidden active namespace config..."

if grep -RniE 'rightsnow|iterlaw-rag-api|iterlaw-ingestion-worker|iterlaw-ollama|iterlaw_knowledge|legal_questions|/api/answer|CLAUDE_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|OLLAMA_URL' k8s/iterlaw k8s/iterlaw-data 2>/dev/null; then
  echo "FAIL: forbidden name/config found in namespace manifests"
  FAIL=1
else
  echo "PASS: no forbidden names in namespace manifests"
fi

echo
echo "Checking namespace separation..."

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

echo
echo "Checking model boundary in manifests..."

if grep -RniE 'INTERNAL_MODEL_ENDPOINT|MODEL_MODE|INTERNAL_MODEL_DEFAULT|INTERNAL_MODEL_DRAFTING|INTERNAL_MODEL_DOCUMENT' k8s/iterlaw/legal-orchestrator 2>/dev/null; then
  echo "FAIL: legal-orchestrator manifest contains model config"
  FAIL=1
else
  echo "PASS: legal-orchestrator manifest has no model config"
fi

if grep -Rni 'INTERNAL_MODEL_ENDPOINT' k8s/iterlaw/synthesis-worker/configmap.yaml 2>/dev/null; then
  echo "PASS: synthesis-worker has internal model endpoint"
else
  echo "FAIL: synthesis-worker missing internal model endpoint"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "Namespace baseline verification failed."
  exit 1
fi

echo
echo "PASS: IterLaw namespace baseline verification complete"
