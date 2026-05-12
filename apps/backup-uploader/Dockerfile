# IterLaw backup uploader image.
#
# Carries the minimal toolset the upload + verify CronJobs need:
#   * borgbackup (`borg`)            — Hetzner Storage Box uploads
#   * openssh-client (`ssh`)         — Borg's SSH transport
#   * postgresql16-client (`pg_restore`) — Monday verify drill
#   * bash, coreutils, ca-certificates, gzip
#
# Hard rules:
#   * No secret is baked in. All credentials arrive at runtime via
#     `envFrom: secretRef: iterlaw-backup-borg`.
#   * Runs as a non-root UID by default; the CronJob's
#     securityContext requires runAsNonRoot:true.
#   * The image carries only the entrypoint script — no repository
#     data, no source code.
#
# Build:
#   bash scripts/infra/build-backup-uploader-image.sh
# Push (only when explicitly approved):
#   bash scripts/infra/build-backup-uploader-image.sh --push
#
# Pin by digest in the CronJobs before any apply:
#   ghcr.io/serverax/iterlaw-backup-uploader@sha256:<digest>

FROM alpine:3.20

# Pin specific apk versions only via the lockfile if introduced later.
# Alpine 3.20 ships postgresql16-client (PG16-compatible pg_restore).
RUN apk add --no-cache \
      bash \
      borgbackup \
      ca-certificates \
      coreutils \
      gzip \
      openssh-client \
      postgresql16-client \
      tini \
 && update-ca-certificates 2>/dev/null || true

# Non-root user. UID 70 matches the postgres UID inside the
# postgres:16-alpine image so the entrypoint can read backups written
# by the existing iterlaw-postgres-backup CronJob without ownership
# games on the shared PVC.
RUN addgroup -g 70 -S borguser \
 && adduser -u 70 -S borguser -G borguser -h /home/borguser \
 && mkdir -p /home/borguser/.ssh /backups \
 && chown -R borguser:borguser /home/borguser

COPY --chown=borguser:borguser entrypoint.sh /usr/local/bin/iterlaw-backup-uploader
RUN chmod 755 /usr/local/bin/iterlaw-backup-uploader

# tini reaps zombie sshd children Borg occasionally leaves behind.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/iterlaw-backup-uploader"]
CMD ["--help"]

USER borguser
WORKDIR /home/borguser
