#!/usr/bin/env bash
# build-iterlaw-images.sh — build the three IterLaw images locally.
#
# Does NOT push anywhere. Output tags:
#   iterlaw/legal-orchestrator:local
#   iterlaw/synthesis-worker:local
#   iterlaw/web:local

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v docker > /dev/null 2>&1; then
  echo "build-iterlaw-images: NOT EXECUTED — docker not found"
  exit 1
fi

build_one() {
  local context="$1" image="$2"
  if [[ ! -d "${context}" ]]; then
    echo "build-iterlaw-images: NOT EXECUTED — context missing: ${context}"
    return 1
  fi
  if [[ ! -f "${context}/Dockerfile" ]]; then
    echo "build-iterlaw-images: NOT EXECUTED — Dockerfile missing in: ${context}"
    return 1
  fi
  echo "==> building ${image} from ${context}"
  docker build -t "${image}" "${context}"
}

build_one "${ROOT}/apps/legal-orchestrator" "iterlaw/legal-orchestrator:local"
build_one "${ROOT}/apps/synthesis-worker"   "iterlaw/synthesis-worker:local"
build_one "${ROOT}/apps/web"                "iterlaw/web:local"

echo "build-iterlaw-images: PASS"
