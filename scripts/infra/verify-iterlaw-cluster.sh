#!/usr/bin/env bash
# verify-iterlaw-cluster.sh — read-only checks against the live K3s cluster.
#
# Reports PASS / FAIL / NOT DEPLOYED / NOT EXECUTED per check. Never mutates
# cluster state.

set -uo pipefail

NS="iterlaw-ai"

report() { printf "%-12s %s\n" "$1" "$2"; }

if ! command -v kubectl > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl not found on PATH"
  exit 0
fi
if ! kubectl version --client > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl client check failed"
  exit 0
fi

if ! kubectl get ns "${NS}" > /dev/null 2>&1; then
  report "NOT DEPLOYED" "namespace ${NS}"
  exit 0
fi
report "PASS" "namespace ${NS} exists"

check_deploy() {
  local name="$1"
  if kubectl -n "${NS}" get deploy "${name}" > /dev/null 2>&1; then
    report "PASS" "deployment ${name}"
  else
    report "NOT DEPLOYED" "deployment ${name}"
  fi
}

check_sts() {
  local name="$1"
  if kubectl -n "${NS}" get sts "${name}" > /dev/null 2>&1; then
    report "PASS" "statefulset ${name}"
  else
    report "NOT DEPLOYED" "statefulset ${name}"
  fi
}

check_svc_port() {
  local name="$1" port="$2"
  if ! kubectl -n "${NS}" get svc "${name}" > /dev/null 2>&1; then
    report "NOT DEPLOYED" "service ${name}"
    return
  fi
  local actual
  actual=$(kubectl -n "${NS}" get svc "${name}" -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || true)
  if [[ "${actual}" == "${port}" ]]; then
    report "PASS" "service ${name} exposes port ${port}"
  else
    report "FAIL" "service ${name} expected port ${port}, got '${actual:-<empty>}'"
  fi
}

check_svc_clusterip() {
  local name="$1"
  if ! kubectl -n "${NS}" get svc "${name}" > /dev/null 2>&1; then
    report "NOT DEPLOYED" "service ${name}"
    return
  fi
  local type
  type=$(kubectl -n "${NS}" get svc "${name}" -o jsonpath='{.spec.type}' 2>/dev/null || true)
  if [[ "${type}" == "ClusterIP" ]]; then
    report "PASS" "service ${name} is ClusterIP"
  else
    report "FAIL" "service ${name} expected ClusterIP, got '${type:-<empty>}'"
  fi
}

check_deploy legal-orchestrator
check_deploy synthesis-worker
check_sts synthesis-redis
check_deploy iterlaw-web

check_svc_port legal-orchestrator 3012
check_svc_clusterip synthesis-redis
check_svc_clusterip synthesis-worker

# synthesis-worker must not be exposed publicly.
if kubectl -n "${NS}" get svc synthesis-worker > /dev/null 2>&1; then
  type=$(kubectl -n "${NS}" get svc synthesis-worker -o jsonpath='{.spec.type}' 2>/dev/null || true)
  if [[ "${type}" == "LoadBalancer" || "${type}" == "NodePort" ]]; then
    report "FAIL" "synthesis-worker is publicly exposed (${type})"
  else
    report "PASS" "synthesis-worker not public"
  fi
fi

# Sanity: no rightsnow workloads anywhere in the cluster.
if kubectl get deploy,sts --all-namespaces -o name 2>/dev/null | grep -i rightsnow > /dev/null; then
  report "FAIL" "rightsnow workloads detected in cluster"
else
  report "PASS" "no rightsnow workloads in cluster"
fi

# Sanity: no IterLaw workload deployed in ordinox-ai namespace.
if kubectl get ns ordinox-ai > /dev/null 2>&1; then
  if kubectl -n ordinox-ai get deploy -o name 2>/dev/null | grep -E '(legal-orchestrator|synthesis-worker|iterlaw-web|synthesis-redis)' > /dev/null; then
    report "FAIL" "IterLaw workload found in ordinox-ai namespace"
  else
    report "PASS" "no IterLaw workload in ordinox-ai"
  fi
else
  report "PASS" "ordinox-ai namespace absent"
fi

echo
echo "Cluster snapshot:"
kubectl get all -n "${NS}" 2>/dev/null || true
