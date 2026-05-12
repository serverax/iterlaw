#!/usr/bin/env bash
# load-iterlaw-images-k3s.sh — pipe locally-built images into K3s containerd.
#
# Uses `docker save IMAGE | k3s ctr images import -`. Never deploys.

set -euo pipefail

IMAGES=(
  "iterlaw/legal-orchestrator:local"
  "iterlaw/synthesis-worker:local"
  "iterlaw/web:local"
)

if ! command -v docker > /dev/null 2>&1; then
  echo "load-iterlaw-images-k3s: NOT EXECUTED — docker not found"
  exit 1
fi
if ! command -v k3s > /dev/null 2>&1; then
  echo "load-iterlaw-images-k3s: NOT EXECUTED — k3s not found"
  exit 1
fi

for img in "${IMAGES[@]}"; do
  if ! docker image inspect "${img}" > /dev/null 2>&1; then
    echo "load-iterlaw-images-k3s: FAIL — local image missing: ${img}"
    echo "  build first via scripts/infra/build-iterlaw-images.sh"
    exit 1
  fi
  echo "==> loading ${img}"
  docker save "${img}" | sudo k3s ctr images import -
done

echo "load-iterlaw-images-k3s: PASS"
