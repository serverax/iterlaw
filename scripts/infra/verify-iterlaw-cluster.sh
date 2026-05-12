#!/usr/bin/env bash
# verify-iterlaw-cluster.sh — read-only checks against the live K3s cluster.
#
# Reports one of:
#   PASS         — expected object exists and matches the contract
#   FAIL         — exists but disagrees with the contract
#   WARN         — non-fatal contract gap (e.g. CNI cannot enforce NetworkPolicy)
#   NOT DEPLOYED — object does not exist (acceptable pre-deploy)
#   NOT EXECUTED — the check could not run (e.g. no kubectl context)
#
# Never mutates cluster state.

set -uo pipefail

NS="iterlaw-ai"
DATA_NS="iterlaw-data"

report() { printf "%-12s %s\n" "$1" "$2"; }

if ! command -v kubectl > /dev/null 2>&1; then
  report "NOT EXECUTED" "kubectl not found on PATH"
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

if kubectl get ns "${DATA_NS}" > /dev/null 2>&1; then
  report "PASS" "namespace ${DATA_NS} exists"
else
  report "NOT DEPLOYED" "namespace ${DATA_NS}"
fi

check_deploy() {
  local ns="$1" name="$2"
  if kubectl -n "${ns}" get deploy "${name}" > /dev/null 2>&1; then
    report "PASS" "deployment ${ns}/${name}"
  else
    report "NOT DEPLOYED" "deployment ${ns}/${name}"
  fi
}

check_sts() {
  local ns="$1" name="$2"
  if kubectl -n "${ns}" get sts "${name}" > /dev/null 2>&1; then
    report "PASS" "statefulset ${ns}/${name}"
  else
    report "NOT DEPLOYED" "statefulset ${ns}/${name}"
  fi
}

check_svc_port() {
  local ns="$1" name="$2" port="$3"
  if ! kubectl -n "${ns}" get svc "${name}" > /dev/null 2>&1; then
    report "NOT DEPLOYED" "service ${ns}/${name}"
    return
  fi
  local actual
  actual=$(kubectl -n "${ns}" get svc "${name}" -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || true)
  if [[ "${actual}" == "${port}" ]]; then
    report "PASS" "service ${ns}/${name} exposes port ${port}"
  else
    report "FAIL" "service ${ns}/${name} expected port ${port}, got '${actual:-<empty>}'"
  fi
}

check_svc_clusterip() {
  local ns="$1" name="$2"
  if ! kubectl -n "${ns}" get svc "${name}" > /dev/null 2>&1; then
    report "NOT DEPLOYED" "service ${ns}/${name}"
    return
  fi
  local type
  type=$(kubectl -n "${ns}" get svc "${name}" -o jsonpath='{.spec.type}' 2>/dev/null || true)
  if [[ "${type}" == "ClusterIP" ]]; then
    report "PASS" "service ${ns}/${name} is ClusterIP"
  else
    report "FAIL" "service ${ns}/${name} expected ClusterIP, got '${type:-<empty>}'"
  fi
}

check_not_public() {
  local ns="$1" name="$2"
  if ! kubectl -n "${ns}" get svc "${name}" > /dev/null 2>&1; then
    report "NOT DEPLOYED" "service ${ns}/${name}"
    return
  fi
  local type
  type=$(kubectl -n "${ns}" get svc "${name}" -o jsonpath='{.spec.type}' 2>/dev/null || true)
  if [[ "${type}" == "LoadBalancer" || "${type}" == "NodePort" ]]; then
    report "FAIL" "${ns}/${name} is publicly exposed (${type})"
  else
    report "PASS" "${ns}/${name} not public"
  fi
}

check_deploy "${NS}" legal-orchestrator
check_deploy "${NS}" synthesis-worker
check_sts    "${NS}" synthesis-redis
check_deploy "${NS}" iterlaw-web
check_sts    "${DATA_NS}" iterlaw-postgres

check_svc_port      "${NS}"      legal-orchestrator 3012
check_svc_port      "${DATA_NS}" iterlaw-postgres   5432
check_svc_clusterip "${NS}"      synthesis-redis
check_svc_clusterip "${NS}"      synthesis-worker
check_svc_clusterip "${DATA_NS}" iterlaw-postgres

check_not_public "${NS}"      synthesis-worker
check_not_public "${DATA_NS}" iterlaw-postgres

# CNI enforcement capability. The IterLaw NetworkPolicy manifests are
# enforced only when a policy-capable CNI is installed. K3s defaults
# (Flannel) accept the manifests but do NOT enforce them.
detect_cni() {
  local ds_names
  ds_names=$(kubectl -n kube-system get ds -o name 2>/dev/null || true)
  if [[ -z "${ds_names}" ]]; then
    report "NOT EXECUTED" "CNI detection (kube-system DaemonSets unreadable)"
    return
  fi
  if echo "${ds_names}" | grep -qiE 'cilium|calico|kube-router'; then
    local match
    match=$(echo "${ds_names}" | grep -iE 'cilium|calico|kube-router' | head -1 | sed 's|daemonset.apps/||')
    report "PASS" "policy-capable CNI detected (${match})"
  else
    report "WARN" "NetworkPolicy may not be enforced — install Cilium or Calico"
    report "WARN" "  observed kube-system DaemonSets:"
    echo "${ds_names}" | sed 's|daemonset.apps/|             |'
  fi
}
detect_cni

# Pod-security namespace labels — enforced by the kube-apiserver,
# independent of the CNI.
check_pss_label() {
  local ns="$1"
  if ! kubectl get ns "${ns}" > /dev/null 2>&1; then
    report "NOT DEPLOYED" "pod-security labels on ${ns}"
    return
  fi
  local enforce
  enforce=$(kubectl get ns "${ns}" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null || true)
  if [[ "${enforce}" == "baseline" || "${enforce}" == "restricted" ]]; then
    report "PASS" "pod-security enforce=${enforce} on ${ns}"
  else
    report "FAIL" "pod-security enforce label missing or weak on ${ns} (got '${enforce:-<empty>}')"
  fi
}
check_pss_label "${NS}"
check_pss_label "${DATA_NS}"

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
