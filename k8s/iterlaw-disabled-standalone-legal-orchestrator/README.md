# Archived: standalone legal-orchestrator kustomize (do not apply)

This directory preserves the **legacy** `k8s/legal-orchestrator/` kustomize
bundle that predates the canonical **`k8s/iterlaw/`** layout.

## Why archived

- The canonical hardened Deployment, Service, ConfigMaps, RBAC, and
  namespace labels live under **`k8s/iterlaw/`** (e.g.
  `k8s/iterlaw/legal-orchestrator/deployment.yaml`).
- The archived `deployment.yaml` used **`image: …:latest`** with
  **`imagePullPolicy: Always`**, which violates production pin policy.
- The archived manifests lacked the pod security posture of the
  `k8s/iterlaw` bundle (service account token mount, seccomp, read-only
  root FS, WASM volume mounts, etc.).

## Operator rule

**Do not `kubectl apply -k` this directory.** Apply **`k8s/iterlaw/`**
(or your approved overlay) only.
