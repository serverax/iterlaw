// Sprint 12 — Track B backup + restore-verify safety tests.
//
// These tests prove the safety properties of the local-workstation
// backup pipeline WITHOUT touching a real database. They exercise the
// pure JS validator modules, scan the shell scripts for forbidden
// patterns, and run the bash dry-run end-to-end where bash is available.
//
// The scripts under scripts/backup/ are operator tooling, not part of
// the orchestrator runtime, but live under the same vitest harness so
// CI catches regressions.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");

const PATHS = {
  adr: join(REPO_ROOT, "docs", "iterlaw", "project", "12-backup-go-live", "ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md"),
  backupScript: join(REPO_ROOT, "scripts", "backup", "iterlaw-db-backup.sh"),
  restoreScript: join(REPO_ROOT, "scripts", "backup", "iterlaw-db-restore-verify.sh"),
  manifestValidator: join(REPO_ROOT, "scripts", "backup", "manifestValidator.mjs"),
  manifestCli: join(REPO_ROOT, "scripts", "backup", "verify-backup-manifest.mjs"),
  restoreTargetValidator: join(REPO_ROOT, "scripts", "backup", "restoreTargetValidator.mjs"),
};

const validatorUrl = pathToFileURL(PATHS.manifestValidator).href;
const restoreTargetUrl = pathToFileURL(PATHS.restoreTargetValidator).href;

// Dynamic imports so the test file does not fail at parse time if the
// modules are missing (it will fail at the "files exist" assertion
// instead, which is clearer).
const validatorModule = await import(/* @vite-ignore */ validatorUrl);
const restoreTargetModule = await import(/* @vite-ignore */ restoreTargetUrl);

const { validateManifest, REQUIRED_FIELDS } = validatorModule as {
  validateManifest: (m: unknown, opts?: { requireChecksumWhenLive?: boolean }) => { ok: boolean; errors: string[] };
  REQUIRED_FIELDS: readonly string[];
};

const { validateRestoreTarget, isProductionHost, isProductionLabel } = restoreTargetModule as {
  validateRestoreTarget: (i: { sourceDsn?: string; targetDsn?: string; restoreLabel?: string }) => { ok: boolean; errors: string[] };
  isProductionHost: (h: string) => boolean;
  isProductionLabel: (l: string) => boolean;
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function bashAvailable(): boolean {
  const r = spawnSync("bash", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

// ------------------------------------------------------------------
// File presence
// ------------------------------------------------------------------

describe("sprint 12 — backup track-B artefacts exist", () => {
  for (const [name, path] of Object.entries(PATHS)) {
    it(`${name} file exists`, () => {
      expect(existsSync(path), `expected ${path}`).toBe(true);
      expect(statSync(path).isFile()).toBe(true);
    });
  }
});

// ------------------------------------------------------------------
// Manifest validator — positive
// ------------------------------------------------------------------

function validDryRunManifest(): Record<string, unknown> {
  return {
    backup_id: "iterlaw-sprint12-dry-run-20260513T010203Z-1234",
    created_at_utc: "2026-05-13T01:02:03Z",
    project: "iterlaw",
    environment_label: "local-staging",
    database_label: "local-docker",
    backup_format: "custom",
    compressed: true,
    dump_file: "iterlaw-sprint12-dry-run-20260513T010203Z.pgcustom",
    checksum_file: "iterlaw-sprint12-dry-run-20260513T010203Z.pgcustom.sha256",
    sha256: null,
    retention_days: 14,
    tool_versions: { pg_dump: "unknown", bash: "5.3.x", node: "v20.x" },
    git_commit: "abcdef123456",
    command_mode: "dry-run",
    secret_redaction: true,
  };
}

function validLiveManifest(): Record<string, unknown> {
  return {
    ...validDryRunManifest(),
    command_mode: "live",
    sha256: "a".repeat(64),
  };
}

describe("manifestValidator: positive cases", () => {
  it("Test 1: accepts a valid dry-run manifest", () => {
    const r = validateManifest(validDryRunManifest());
    expect(r.ok, r.errors.join("; ")).toBe(true);
  });

  it("accepts a valid live manifest with 64-hex sha256", () => {
    const r = validateManifest(validLiveManifest());
    expect(r.ok, r.errors.join("; ")).toBe(true);
  });

  it("covers all required fields", () => {
    expect(REQUIRED_FIELDS).toContain("backup_id");
    expect(REQUIRED_FIELDS).toContain("sha256");
    expect(REQUIRED_FIELDS).toContain("secret_redaction");
  });
});

// ------------------------------------------------------------------
// Manifest validator — rejection cases
// ------------------------------------------------------------------

describe("manifestValidator: rejection cases", () => {
  it("Test 2: rejects missing checksum_file field", () => {
    const m = validLiveManifest();
    delete (m as Record<string, unknown>).checksum_file;
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /checksum_file/.test(e))).toBe(true);
  });

  it("Test 2b: rejects missing sha256 field in live mode", () => {
    const m = validLiveManifest();
    delete (m as Record<string, unknown>).sha256;
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /sha256/.test(e))).toBe(true);
  });

  it("Test 3: rejects DATABASE_URL leakage", () => {
    const m = validDryRunManifest();
    (m as Record<string, unknown>).database_label = "DATABASE_URL=postgresql://user:secret@host/db";
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /postgresql:\/\/|secret-like/.test(e))).toBe(true);
  });

  it("Test 4: rejects postgres:// leakage in any nested field", () => {
    const m = validDryRunManifest();
    (m as Record<string, unknown>).tool_versions = {
      pg_dump: "postgres://user:pw@host:5432/db",
      bash: "5",
      node: "v20",
    };
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /postgres:\/\/|secret-like/.test(e))).toBe(true);
  });

  it("Test 5: rejects POSTGRES_PASSWORD leakage", () => {
    const m = validDryRunManifest();
    (m as Record<string, unknown>).database_label = "POSTGRES_PASSWORD foo";
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /POSTGRES_PASSWORD|secret-like/.test(e))).toBe(true);
  });

  it("rejects project != iterlaw", () => {
    const m = validDryRunManifest();
    (m as Record<string, unknown>).project = "rightsnow";
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
  });

  it("rejects secret_redaction !== true", () => {
    const m = validDryRunManifest();
    (m as Record<string, unknown>).secret_redaction = false;
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
  });

  it("rejects malformed sha256 in live mode", () => {
    const m = validLiveManifest();
    (m as Record<string, unknown>).sha256 = "not-a-real-hash";
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
  });

  it("rejects an obvious GitHub PAT pattern in any value", () => {
    const m = validDryRunManifest();
    (m as Record<string, unknown>).database_label = "ghp_" + "x".repeat(40);
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
  });

  it("rejects a non-object manifest", () => {
    const r = validateManifest("not an object" as unknown);
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------
// Restore target validator
// ------------------------------------------------------------------

describe("restoreTargetValidator", () => {
  it("Test 6a: refuses identical source and target DSN", () => {
    const dsn = "postgres://app:pw@localhost:5432/iterlaw";
    const r = validateRestoreTarget({
      sourceDsn: dsn,
      targetDsn: dsn,
      restoreLabel: "drill",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /identical|differ/i.test(e))).toBe(true);
  });

  it("Test 6b: refuses identical hosts even with different DSN suffix", () => {
    const r = validateRestoreTarget({
      sourceDsn: "postgres://app:pw@same.host:5432/db1",
      targetDsn: "postgres://other:pw@same.host:5432/db2",
      restoreLabel: "drill",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /host/i.test(e))).toBe(true);
  });

  it("Test 7: refuses production target host (cluster-DNS)", () => {
    const r = validateRestoreTarget({
      targetDsn: "postgres://app:pw@iterlaw-postgres.iterlaw-data.svc.cluster.local:5432/iterlaw",
      restoreLabel: "drill",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /denylist|production/i.test(e))).toBe(true);
  });

  it("Test 7b: refuses target host containing iterlaw-prod", () => {
    const r = validateRestoreTarget({
      targetDsn: "postgres://app:pw@iterlaw-prod-db.internal:5432/iterlaw",
      restoreLabel: "drill",
    });
    expect(r.ok).toBe(false);
  });

  it("Test 7c: refuses production label", () => {
    const r = validateRestoreTarget({
      targetDsn: "postgres://app:pw@drill.local:5432/iterlaw",
      restoreLabel: "production",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts an isolated drill target", () => {
    const r = validateRestoreTarget({
      sourceDsn: "postgres://app:pw@source.local:5432/iterlaw",
      targetDsn: "postgres://app:pw@drill.local:5433/iterlaw_restore",
      restoreLabel: "drill-2026Q2",
    });
    expect(r.ok, r.errors.join("; ")).toBe(true);
  });

  it("isProductionHost helper recognises the cluster-DNS hostname", () => {
    expect(isProductionHost("iterlaw-postgres.iterlaw-data.svc.cluster.local")).toBe(true);
    expect(isProductionHost("drill.local")).toBe(false);
  });

  it("isProductionLabel helper rejects 'production' and 'prod'", () => {
    expect(isProductionLabel("production")).toBe(true);
    expect(isProductionLabel("PROD")).toBe(true);
    expect(isProductionLabel("drill")).toBe(false);
  });
});

// ------------------------------------------------------------------
// Shell-script static safety scan
// ------------------------------------------------------------------

describe("shell scripts — static safety scan", () => {
  it("backup script uses set -euo pipefail", () => {
    expect(read(PATHS.backupScript)).toMatch(/set -euo pipefail/);
  });

  it("restore script uses set -euo pipefail", () => {
    expect(read(PATHS.restoreScript)).toMatch(/set -euo pipefail/);
  });

  it("backup script reads DSN only from ITERLAW_BACKUP_DATABASE_URL", () => {
    const body = read(PATHS.backupScript);
    expect(body).toMatch(/ITERLAW_BACKUP_DATABASE_URL/);
    // No hard-coded credential-bearing DSN in the script body.
    // Forbid postgres://user:pw@... style with embedded credentials.
    expect(body).not.toMatch(/postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@/);
  });

  it("restore script reads target DSN only from ITERLAW_RESTORE_DATABASE_URL", () => {
    const body = read(PATHS.restoreScript);
    expect(body).toMatch(/ITERLAW_RESTORE_DATABASE_URL/);
    expect(body).not.toMatch(/postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@/);
  });

  it("restore script refuses production-host denylist", () => {
    const body = read(PATHS.restoreScript);
    expect(body).toMatch(/iterlaw-postgres\\\.iterlaw-data\\\.svc\\\.cluster\\\.local|iterlaw-prod/);
    expect(body).toMatch(/REFUSED/);
  });

  it("restore script refuses production restore label", () => {
    const body = read(PATHS.restoreScript);
    expect(body).toMatch(/production\$/);
  });

  it("neither script contains a literal POSTGRES_PASSWORD value", () => {
    for (const p of [PATHS.backupScript, PATHS.restoreScript]) {
      const body = read(p);
      expect(body, p).not.toMatch(/POSTGRES_PASSWORD\s*=\s*['"]?[A-Za-z0-9!@#%^&*()_+]{8,}/);
    }
  });

  it("neither script calls kubectl mutating verbs", () => {
    for (const p of [PATHS.backupScript, PATHS.restoreScript]) {
      const body = read(p);
      expect(body, p).not.toMatch(/kubectl\s+(apply|delete|patch|edit|scale|rollout|drain)/);
    }
  });
});

// ------------------------------------------------------------------
// End-to-end dry-run via bash (best-effort; skip if bash absent)
// ------------------------------------------------------------------

const HAS_BASH = bashAvailable();

describe("dry-run: backup script does not require a real DB", () => {
  if (!HAS_BASH) {
    it.skip("(bash not available — skipped)", () => {});
    return;
  }

  it("Test 8: dry-run produces a manifest without ITERLAW_BACKUP_DATABASE_URL", { timeout: 30000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "iterlaw-s12-"));
    try {
      const out = execFileSync(
        "bash",
        [
          PATHS.backupScript,
          "--dry-run",
          "--output-dir",
          dir,
          "--label",
          "sprint12-test",
        ],
        { encoding: "utf8", env: { ...process.env, ITERLAW_BACKUP_DATABASE_URL: "" } },
      );
      expect(out).toMatch(/manifest written:/);
      // No DSN should leak into stdout.
      expect(out).not.toMatch(/postgres:\/\//);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Test 9: dry-run output contains no secret-like value (manifest body)", { timeout: 30000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "iterlaw-s12-"));
    try {
      execFileSync("bash", [
        PATHS.backupScript,
        "--dry-run",
        "--output-dir",
        dir,
        "--label",
        "sprint12-test",
      ]);
      const entries = require("node:fs").readdirSync(dir);
      const manifestName = entries.find((n: string) => n.endsWith(".manifest.json"));
      expect(manifestName, "manifest file produced").toBeDefined();
      const body = read(join(dir, manifestName!));
      expect(body).not.toMatch(/postgres:\/\//);
      expect(body).not.toMatch(/postgresql:\/\//);
      expect(body).not.toMatch(/POSTGRES_PASSWORD/);
      expect(body).not.toMatch(/PGPASSWORD/);
      expect(body).not.toMatch(/BORG_PASSPHRASE/);
      // And the validator must accept it.
      const parsed = JSON.parse(body) as unknown;
      const r = validateManifest(parsed);
      expect(r.ok, r.errors.join("; ")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("dry-run: restore-verify script produces a redacted report", () => {
  if (!HAS_BASH) {
    it.skip("(bash not available — skipped)", () => {});
    return;
  }

  it("Test 10: report includes secret_redaction true + no DSN leaked", { timeout: 30000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "iterlaw-s12-"));
    try {
      // Make a manifest first.
      execFileSync("bash", [
        PATHS.backupScript,
        "--dry-run",
        "--output-dir",
        dir,
        "--label",
        "sprint12-test",
      ]);
      const entries = require("node:fs").readdirSync(dir);
      const manifestName = entries.find((n: string) => n.endsWith(".manifest.json"))!;
      const manifestPath = join(dir, manifestName);
      const reportPath = join(dir, "restore-report.json");

      const out = execFileSync(
        "bash",
        [
          PATHS.restoreScript,
          "--dry-run",
          "--backup-manifest",
          manifestPath,
          "--report-out",
          reportPath,
        ],
        { encoding: "utf8" },
      );
      expect(out).toMatch(/report written:/);

      const report = JSON.parse(read(reportPath)) as Record<string, unknown>;
      expect(report.secret_redaction).toBe(true);
      expect(report.production_restore_attempted).toBe(false);
      expect(report.destructive_action_performed).toBe(false);
      expect(report.restore_mode).toBe("dry-run");
      expect(report.restore_target_host).toBe("[REDACTED]");

      const body = read(reportPath);
      expect(body).not.toMatch(/postgres:\/\//);
      expect(body).not.toMatch(/postgresql:\/\//);
      expect(body).not.toMatch(/POSTGRES_PASSWORD/);
      expect(body).not.toMatch(/BORG_PASSPHRASE/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Test 11 (live-mode refusal): refuses when ITERLAW_RESTORE_DATABASE_URL is empty", { timeout: 30000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "iterlaw-s12-"));
    try {
      execFileSync("bash", [
        PATHS.backupScript,
        "--dry-run",
        "--output-dir",
        dir,
        "--label",
        "sprint12-test",
      ]);
      const entries = require("node:fs").readdirSync(dir);
      const manifestName = entries.find((n: string) => n.endsWith(".manifest.json"))!;
      const manifestPath = join(dir, manifestName);
      const reportPath = join(dir, "restore-report.json");

      const r = spawnSync(
        "bash",
        [
          PATHS.restoreScript,
          "--no-dry-run",
          "--backup-manifest",
          manifestPath,
          "--report-out",
          reportPath,
        ],
        { encoding: "utf8", env: { ...process.env, ITERLAW_RESTORE_DATABASE_URL: "" } },
      );
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/ITERLAW_RESTORE_DATABASE_URL/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
