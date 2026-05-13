// Pure manifest validator for Sprint 12 Track B backup manifests.
//
// Imported by both:
//   - scripts/backup/verify-backup-manifest.mjs (CLI wrapper)
//   - apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts
//
// No I/O at module import time. No console.log at import time. Pure
// functions so the test suite can call them deterministically.

export const REQUIRED_FIELDS = [
  "backup_id",
  "created_at_utc",
  "project",
  "environment_label",
  "database_label",
  "backup_format",
  "compressed",
  "dump_file",
  "checksum_file",
  "sha256",
  "retention_days",
  "tool_versions",
  "git_commit",
  "command_mode",
  "secret_redaction",
];

export const FORBIDDEN_VALUE_PATTERNS = [
  /postgres:\/\//i,
  /postgresql:\/\//i,
  /POSTGRES_PASSWORD\b/,
  /PGPASSWORD\b/,
  /BORG_PASSPHRASE\b/,
  /SSH_PRIVATE_KEY\b/,
  /\bpassword\s*=\s*[^\s"',]+/i,
  /\bsk-[A-Za-z0-9]{12,}/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:]+:[^/\s@]+@/i,
];

const ALLOWED_FORMATS = new Set(["custom", "plain", "directory", "tar"]);
const ALLOWED_MODES = new Set(["dry-run", "live"]);

function isPlainObject(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function deepStringify(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function scanForbidden(value, path, hits) {
  if (typeof value === "string") {
    for (const re of FORBIDDEN_VALUE_PATTERNS) {
      if (re.test(value)) {
        hits.push(`forbidden pattern ${re} found at ${path}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForbidden(v, `${path}[${i}]`, hits));
    return;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      scanForbidden(v, path ? `${path}.${k}` : k, hits);
    }
  }
}

export function validateManifest(manifest, options = {}) {
  const { requireChecksumWhenLive = true } = options;
  const errors = [];

  if (!isPlainObject(manifest)) {
    return { ok: false, errors: ["manifest is not a JSON object"] };
  }

  for (const f of REQUIRED_FIELDS) {
    if (!(f in manifest)) {
      errors.push(`missing required field: ${f}`);
    }
  }

  if (manifest.project !== "iterlaw") {
    errors.push(`project must be "iterlaw", got ${deepStringify(manifest.project)}`);
  }

  if (typeof manifest.backup_id !== "string" || manifest.backup_id.length < 8) {
    errors.push("backup_id must be a non-trivial string");
  }

  if (
    typeof manifest.created_at_utc !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(manifest.created_at_utc)
  ) {
    errors.push("created_at_utc must be ISO-8601 UTC (Z suffix)");
  }

  if (!ALLOWED_FORMATS.has(manifest.backup_format)) {
    errors.push(`backup_format must be one of ${[...ALLOWED_FORMATS].join("|")}`);
  }

  if (typeof manifest.compressed !== "boolean") {
    errors.push("compressed must be boolean");
  }

  if (typeof manifest.dump_file !== "string" || manifest.dump_file.length === 0) {
    errors.push("dump_file must be a non-empty string");
  }

  if (typeof manifest.checksum_file !== "string" || manifest.checksum_file.length === 0) {
    errors.push("checksum_file must be a non-empty string");
  }

  if (!ALLOWED_MODES.has(manifest.command_mode)) {
    errors.push(`command_mode must be one of ${[...ALLOWED_MODES].join("|")}`);
  }

  if (manifest.secret_redaction !== true) {
    errors.push("secret_redaction must be exactly true");
  }

  if (typeof manifest.retention_days !== "number" || manifest.retention_days < 1) {
    errors.push("retention_days must be a positive number");
  }

  if (!isPlainObject(manifest.tool_versions)) {
    errors.push("tool_versions must be an object");
  }

  if (typeof manifest.git_commit !== "string" || manifest.git_commit.length < 7) {
    errors.push("git_commit must be a short or full SHA");
  }

  if (manifest.command_mode === "live") {
    if (requireChecksumWhenLive) {
      if (typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
        errors.push("sha256 must be a 64-hex string in live mode");
      }
    }
  } else if (manifest.command_mode === "dry-run") {
    // In dry-run, sha256 may be null (no real dump produced).
    if (manifest.sha256 !== null && manifest.sha256 !== "" && manifest.sha256 !== undefined) {
      if (typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
        errors.push("sha256 in dry-run must be null/empty or 64-hex");
      }
    }
  }

  const forbidden = [];
  scanForbidden(manifest, "", forbidden);
  for (const f of forbidden) {
    errors.push(`secret-like leak: ${f}`);
  }

  return { ok: errors.length === 0, errors };
}

export function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/i.test(s);
}
