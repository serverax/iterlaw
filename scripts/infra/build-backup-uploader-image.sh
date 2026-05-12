#!/usr/bin/env bash
# build-backup-uploader-image.sh
#
# Build the iterlaw-backup-uploader image. Pushes ONLY when --push is
# explicitly passed. Never pushes by default. Never alters cluster
# state. Refuses to run if `docker` is not on PATH (reports
# DOCKER_NOT_AVAILABLE and exits non-zero, except --help).
#
# Usage:
#   bash scripts/infra/build-backup-uploader-image.sh
#   bash scripts/infra/build-backup-uploader-image.sh --image <ref> --tag <tag>
#   bash scripts/infra/build-backup-uploader-image.sh --push

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT="${REPO_ROOT}/apps/backup-uploader"

IMAGE="ghcr.io/serverax/iterlaw-backup-uploader"
TAG=""
PUSH=0

usage() {
  cat <<USAGE
build-backup-uploader-image.sh

  --image <ref>   Override image repository (default: ${IMAGE})
  --tag <tag>     Override image tag (default: short git SHA, or 'local')
  --push          Push after build. Off by default. Requires prior
                  `docker login` to the chosen registry.
  -h | --help     Print this help and exit 0.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="${2:?--image requires a value}"; shift 2 ;;
    --tag)   TAG="${2:?--tag requires a value}";     shift 2 ;;
    --push)  PUSH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1"; usage; exit 2 ;;
  esac
done

if [[ -z "${TAG}" ]]; then
  if git -C "${REPO_ROOT}" rev-parse --short HEAD > /dev/null 2>&1; then
    TAG="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
  else
    TAG="local"
  fi
fi

if ! command -v docker > /dev/null 2>&1; then
  echo "DOCKER_NOT_AVAILABLE — install Docker or use a remote build runner"
  exit 3
fi

if [[ ! -d "${CONTEXT}" ]]; then
  echo "FAIL: build context missing: ${CONTEXT}"
  exit 4
fi
if [[ ! -f "${CONTEXT}/Dockerfile" ]]; then
  echo "FAIL: Dockerfile missing in build context: ${CONTEXT}/Dockerfile"
  exit 4
fi

REF="${IMAGE}:${TAG}"

echo "==> building ${REF} from ${CONTEXT}"
docker build --pull --tag "${REF}" "${CONTEXT}"
echo "==> built: ${REF}"

if [[ "${PUSH}" -eq 1 ]]; then
  echo "==> pushing ${REF}"
  docker push "${REF}"

  # docker push prints the digest on the final line; try to surface it
  # explicitly so the operator can pin it in the CronJobs.
  if docker image inspect --format='{{index .RepoDigests 0}}' "${REF}" > /dev/null 2>&1; then
    digest="$(docker image inspect --format='{{index .RepoDigests 0}}' "${REF}" 2>/dev/null | head -1 || true)"
    if [[ -n "${digest}" ]]; then
      echo "==> digest reference: ${digest}"
      echo "    pin this in k8s/iterlaw-data/backups/upload-cronjob.yaml + verify-cronjob.yaml"
    fi
  fi
else
  echo "==> (skipped push — pass --push to push)"
fi
