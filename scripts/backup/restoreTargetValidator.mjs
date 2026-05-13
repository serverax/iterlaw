// Pure validator for Sprint 12 restore-target safety.
//
// Imported by both:
//   - scripts/backup/iterlaw-db-restore-verify.sh's optional node helper
//   - apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts
//
// No I/O at module import time.

export const PRODUCTION_HOSTNAME_DENYLIST = [
  /iterlaw-postgres\.iterlaw-data\.svc\.cluster\.local/i,
  /\biterlaw-prod\b/i,
  /^prod[.-]/i,
  /[.-]prod[.-]/i,
  /\bprod[.-][a-z0-9-]*iterlaw\b/i,
];

export const PRODUCTION_LABEL_DENYLIST = [
  /^production$/i,
  /^prod$/i,
];

function parseDsnHost(dsn) {
  if (typeof dsn !== "string" || dsn.length === 0) return null;
  try {
    const u = new URL(dsn);
    return u.hostname;
  } catch {
    // Best-effort regex parse for postgres://[user[:pw]@]host[:port]/db
    const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^:/?#]+)/i.exec(dsn);
    return m ? m[1] : null;
  }
}

export function isProductionHost(host) {
  if (typeof host !== "string" || host.length === 0) return false;
  return PRODUCTION_HOSTNAME_DENYLIST.some((re) => re.test(host));
}

export function isProductionLabel(label) {
  if (typeof label !== "string" || label.length === 0) return false;
  return PRODUCTION_LABEL_DENYLIST.some((re) => re.test(label));
}

export function validateRestoreTarget({ sourceDsn, targetDsn, restoreLabel } = {}) {
  const errors = [];

  if (typeof targetDsn !== "string" || targetDsn.length === 0) {
    errors.push("restore target DSN is empty");
    return { ok: false, errors };
  }

  const targetHost = parseDsnHost(targetDsn);
  if (!targetHost) {
    errors.push("restore target DSN is unparseable");
  }

  if (typeof sourceDsn === "string" && sourceDsn.length > 0) {
    if (sourceDsn === targetDsn) {
      errors.push("restore target DSN must differ from source DSN");
    }
    const sourceHost = parseDsnHost(sourceDsn);
    if (sourceHost && targetHost && sourceHost === targetHost) {
      errors.push(`restore target host must differ from source host (both are ${sourceHost})`);
    }
  }

  if (targetHost && isProductionHost(targetHost)) {
    errors.push(`restore target host is on production denylist: ${targetHost}`);
  }

  if (typeof restoreLabel === "string" && isProductionLabel(restoreLabel)) {
    errors.push(`restore label '${restoreLabel}' is reserved for production and is refused`);
  }

  return { ok: errors.length === 0, errors };
}
