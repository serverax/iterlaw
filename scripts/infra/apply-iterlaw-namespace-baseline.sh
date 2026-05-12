#!/usr/bin/env bash
set -euo pipefail

echo "Applying IterLaw namespace baseline..."

kubectl apply -f k8s/iterlaw/namespace.yaml
kubectl apply -f k8s/iterlaw-data/namespace.yaml

kubectl apply -f k8s/iterlaw/serviceaccount.yaml
kubectl apply -f k8s/iterlaw/resourcequotas.yaml
kubectl apply -f k8s/iterlaw/limitranges.yaml

kubectl apply -f k8s/iterlaw-data/serviceaccount.yaml
kubectl apply -f k8s/iterlaw-data/resourcequotas.yaml
kubectl apply -f k8s/iterlaw-data/limitranges.yaml

kubectl apply -f k8s/iterlaw/legal-orchestrator/configmap.yaml
kubectl apply -f k8s/iterlaw/synthesis-worker/configmap.yaml
kubectl apply -f k8s/iterlaw/web/configmap.yaml
kubectl apply -f k8s/iterlaw/wasm-rule-runner/configmap.yaml

kubectl apply -f k8s/iterlaw/redis/service.yaml
kubectl apply -f k8s/iterlaw/redis/statefulset.yaml

kubectl apply -f k8s/iterlaw-data/postgres/configmap.yaml
kubectl apply -f k8s/iterlaw-data/postgres/service.yaml

echo
echo "Namespace baseline applied."
echo "Postgres StatefulSet is NOT applied here because DB secret must exist first:"
echo "- iterlaw-data/iterlaw-postgres-secret"
echo
kubectl get all -n iterlaw-ai
kubectl get all -n iterlaw-data
