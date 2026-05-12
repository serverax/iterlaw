#!/usr/bin/env bash
set -euo pipefail

echo "=== IterLaw cluster verification ==="

kubectl get namespace iterlaw-ai >/dev/null 2>&1 \
  && echo "PASS: namespace iterlaw-ai exists" \
  || echo "NOT DEPLOYED: namespace iterlaw-ai missing"

kubectl get namespace iterlaw-data >/dev/null 2>&1 \
  && echo "PASS: namespace iterlaw-data exists" \
  || echo "NOT DEPLOYED: namespace iterlaw-data missing"

echo
echo "=== iterlaw-ai resources ==="
kubectl get all -n iterlaw-ai 2>/dev/null || true

echo
echo "=== iterlaw-data resources ==="
kubectl get all -n iterlaw-data 2>/dev/null || true

echo
echo "=== Ollama temporary model endpoint ==="
kubectl get svc ollama -n ordinox-ai 2>/dev/null \
  && echo "PASS: existing Ollama service found in ordinox-ai" \
  || echo "FAIL: Ollama service not found in ordinox-ai"
