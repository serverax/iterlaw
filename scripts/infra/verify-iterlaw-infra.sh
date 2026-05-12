#!/usr/bin/env bash
# verify-iterlaw-infra.sh — read-only cluster + repo checks for the
# Master-Order single-namespace IterLaw layout (`namespace: iterlaw`).
#
# This script never mutates the cluster. It reports one of:
#   PASS         — expected object exists.
#   FAIL         — exists but disagrees with the expected shape.
#   NOT DEPLOYED — object does not exist (acceptable pre-deploy).
#   NOT EXECUTED — the check could not run (kubectl missing/no context).
#
# It also runs a static check that no public Ingress is defined under
# k8s/iterlaw/*.yaml and that the example-secret files do not carry
# values that look like real credentials.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NS="iterlaw"

report() { printf "%-12s %s\n" "$1" "$2"; }

# ---------------------------------------------------------------------
# Static repo checks (no cluster required).
# ---------------------------------------------------------------------

K8S_DIR="${REPO_ROOT}/k8s/iterlaw"
if [[ -d "${K8S_DIR}" ]]; then
  report "PASS" "k8s/iterlaw directory exists"

  for f in 00-namespace.yaml 10-postgres-pvc.yaml 11-postgres-secret.example.yaml \
           12-postgres-deployment.yaml 13-postgres-service.yaml \
           20-legal-orchestrator-configmap.yaml 21-legal-orchestrator-secret.example.yaml \
           22-legal-orchestrator-deployment.yaml 23-legal-orchestrator-service.yaml; do
    if [[ -f "${K8S_DIR}/${f}" ]]; then
      report "PASS" "manifest ${f}"
    else
      report "FAIL" "missing manifest ${f}"
    fi
  done

  # No public Ingress under the new k8s/iterlaw/NN-*.yaml layout.
  if grep -lE "^kind:\s*Ingress" "${K8S_DIR}"/*.yaml > /dev/null 2>&1; then
    report "FAIL" "public Ingress found under k8s/iterlaw/*.yaml (Master Order: no public ingress yet)"
  else
    report "PASS" "no public Ingress under k8s/iterlaw/*.yaml"
  fi

  # Example secrets must NOT contain real-looking credentials.
  for f in "${K8S_DIR}/11-postgres-secret.example.yaml" "${K8S_DIR}/21-legal-orchestrator-secret.example.yaml"; do
    if [[ -f "${f}" ]]; then
      if grep -qE "REPLACE_ME" "${f}"; then
        report "PASS" "$(basename "${f}") uses REPLACE_ME placeholders"
      else
        report "FAIL" "$(basename "${f}") has no REPLACE_ME marker"
      fi
    fi
  done
else
  report "NOT DEPLOYED" "k8s/iterlaw directory"
fi

# ---------------------------------------------------------------------
# Live cluster checks (best effort).
# ---------------------------------------------------------------------

if ! command -v kubectl > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl not on PATH"
  exit 0
fi
if ! kubectl version --client > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl client check failed"
  exit 0
fi

if kubectl get ns "${NS}" > /dev/null 2>&1; then
  report "PASS" "namespace ${NS} exists"
else
  report "NOT DEPLOYED" "namespace ${NS}"
fi

# Postgres deployment + service.
if kubectl -n "${NS}" get deploy iterlaw-postgres > /dev/null 2>&1; then
  report "PASS" "deployment ${NS}/iterlaw-postgres"
else
  report "NOT DEPLOYED" "deployment ${NS}/iterlaw-postgres"
fi
if kubectl -n "${NS}" get svc iterlaw-postgres > /dev/null 2>&1; then
  port=$(kubectl -n "${NS}" get svc iterlaw-postgres -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || true)
  type=$(kubectl -n "${NS}" get svc iterlaw-postgres -o jsonpath='{.spec.type}' 2>/dev/null || true)
  if [[ "${port}" == "5432" ]]; then
    report "PASS" "service ${NS}/iterlaw-postgres on 5432 (${type})"
  else
    report "FAIL" "service ${NS}/iterlaw-postgres expected port 5432, got '${port:-<empty>}'"
  fi
else
  report "NOT DEPLOYED" "service ${NS}/iterlaw-postgres"
fi

# Legal orchestrator config + service.
if kubectl -n "${NS}" get cm iterlaw-legal-orchestrator-config > /dev/null 2>&1; then
  report "PASS" "configmap ${NS}/iterlaw-legal-orchestrator-config"
else
  report "NOT DEPLOYED" "configmap ${NS}/iterlaw-legal-orchestrator-config"
fi
if kubectl -n "${NS}" get svc iterlaw-legal-orchestrator > /dev/null 2>&1; then
  report "PASS" "service ${NS}/iterlaw-legal-orchestrator"
else
  report "NOT DEPLOYED" "service ${NS}/iterlaw-legal-orchestrator"
fi

# No Ingress in the new layout.
if kubectl -n "${NS}" get ingress -o name > /dev/null 2>&1; then
  if [[ -n "$(kubectl -n "${NS}" get ingress -o name 2>/dev/null)" ]]; then
    report "FAIL" "ingress objects exist in namespace ${NS} (Master Order: no public ingress yet)"
  else
    report "PASS" "no Ingress in ${NS}"
  fi
fi

# Ollama service lookup (best effort).
if kubectl get pods --all-namespaces 2>/dev/null | grep -qi ollama; then
  report "PASS" "ollama pod visible somewhere in the cluster"
elif kubectl get svc --all-namespaces 2>/dev/null | grep -qi ollama; then
  report "PASS" "ollama service visible somewhere in the cluster"
else
  report "NOT DEPLOYED" "ollama not visible in cluster (OLLAMA_UNAVAILABLE)"
fi
