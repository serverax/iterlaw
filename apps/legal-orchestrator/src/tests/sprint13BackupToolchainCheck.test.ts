// Sprint 13 — backup + restore --check toolchain probe safety tests.
//
// These tests exercise the --check mode added to both scripts. The
// --check mode never touches a DB, never opens a socket, never runs
// kubectl, and never reads ITERLAW_BACKUP_DATABASE_URL /
// ITERLAW_RESTORE_DATABASE_URL. All probes are static.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const BACKUP_SCRIPT = join(REPO_ROOT, "scripts", "backup", "iterlaw-db-backup.sh");
const RESTORE_SCRIPT = join(REPO_ROOT, "scripts", "backup", "iterlaw-db-restore-verify.sh");

const manifestValidatorUrl = pathToFileURL(
  join(REPO_ROOT, "scripts", "backup", "manifestValidator.mjs"),
).href;
const restoreTargetUrl = pathToFileURL(
  join(REPO_ROOT, "scripts", "backup", "restoreTargetValidator.mjs"),
).href;

const validatorModule = await import(/* @vite-ignore */ manifestValidatorUrl);
const restoreTargetModule = await import(/* @vite-ignore */ restoreTargetUrl);

const { validateManifest } = validatorModule as {
  validateManifest: (m: unknown) => { ok: boolean; errors: string[] };
};
const { validateRestoreTarget } = restoreTargetModule as {
  validateRestoreTarget: (i: {
    sourceDsn?: string;
    targetDsn?: string;
    restoreLabel?: string;
  }) => { ok: boolean; errors: string[] };
};

// Sprint 12A: resolve bash via the helper so tests work on Windows
// without bash on PATH (set BASH_PATH or install Git Bash). If the
// helper fails to find bash it throws with a clear message — tests
// then fail loudly instead of silently skipping.
import { resolveBashPath } from "./helpers/resolveBash";
const BASH_PATH = resolveBashPath();

function runCheck(script: string): {
  status: number | null;
  stdout: string;
  stderr: string;
  json: Record<string, unknown> | null;
} {
  const r = spawnSync(BASH_PATH, [script, "--check"], {
    encoding: "utf8",
    // Intentionally strip backup env vars to prove --check does not
    // require them. We do not export anything we want to keep secret.
    env: {
      ...process.env,
      ITERLAW_BACKUP_DATABASE_URL: "",
      ITERLAW_RESTORE_DATABASE_URL: "",
    },
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(r.stdout.trim()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

// ------------------------------------------------------------------
// backup --check (Tests 1-6 from Task 9). Bash is resolved at module
// load via resolveBashPath(); if unavailable, the resolver throws and
// these tests fail loudly (Sprint 12A correction).
// ------------------------------------------------------------------

describe("Sprint 13 — backup --check toolchain probe", () => {
  it("Test 1: backup --check exits 0", { timeout: 30000 }, () => {
    const r = runCheck(BACKUP_SCRIPT);
    expect(r.status).toBe(0);
  });

  it("Test 2: backup --check does not require DATABASE_URL", { timeout: 30000 }, () => {
    const r = runCheck(BACKUP_SCRIPT);
    expect(r.status).toBe(0);
    expect(r.json, r.stderr).not.toBeNull();
  });

  it("Test 3: backup --check output says database_touched=false", { timeout: 30000 }, () => {
    const r = runCheck(BACKUP_SCRIPT);
    expect(r.json?.database_touched).toBe(false);
  });

  it("Test 4: backup --check output says production_touched=false", { timeout: 30000 }, () => {
    const r = runCheck(BACKUP_SCRIPT);
    expect(r.json?.production_touched).toBe(false);
    expect(r.json?.kubectl_called).toBe(false);
    expect(r.json?.network_opened).toBe(false);
  });

  it("Test 5: backup --check output does not leak postgres://", { timeout: 30000 }, () => {
    const r = runCheck(BACKUP_SCRIPT);
    expect(r.stdout).not.toMatch(/postgres:\/\//);
    expect(r.stdout).not.toMatch(/postgresql:\/\//);
  });

  it("Test 6: backup --check output does not leak POSTGRES_PASSWORD", { timeout: 30000 }, () => {
    const r = runCheck(BACKUP_SCRIPT);
    expect(r.stdout).not.toMatch(/POSTGRES_PASSWORD/);
    expect(r.stdout).not.toMatch(/PGPASSWORD/);
    expect(r.stdout).not.toMatch(/BORG_PASSPHRASE/);
    expect(r.json?.secret_redaction).toBe(true);
    expect(r.json?.ready_for_live_backup).toBe(false);
  });
});

// ------------------------------------------------------------------
// restore --check (Tests 7-11 from Task 9)
// ------------------------------------------------------------------

describe("Sprint 13 — restore --check toolchain probe", () => {
  it("Test 7: restore --check exits 0", { timeout: 30000 }, () => {
    const r = runCheck(RESTORE_SCRIPT);
    expect(r.status).toBe(0);
  });

  it("Test 8: restore --check does not require ITERLAW_RESTORE_DATABASE_URL", { timeout: 30000 }, () => {
    const r = runCheck(RESTORE_SCRIPT);
    expect(r.status).toBe(0);
    expect(r.json).not.toBeNull();
  });

  it("Test 9: restore --check output says database_touched=false", { timeout: 30000 }, () => {
    const r = runCheck(RESTORE_SCRIPT);
    expect(r.json?.database_touched).toBe(false);
  });

  it("Test 10: restore --check output says production_touched=false", { timeout: 30000 }, () => {
    const r = runCheck(RESTORE_SCRIPT);
    expect(r.json?.production_touched).toBe(false);
    expect(r.json?.kubectl_called).toBe(false);
    expect(r.json?.network_opened).toBe(false);
  });

  it("Test 11: restore --check output says live_restore_authorised=false", { timeout: 30000 }, () => {
    const r = runCheck(RESTORE_SCRIPT);
    expect(r.json?.live_restore_authorised).toBe(false);
    expect(r.stdout).not.toMatch(/postgres:\/\//);
    expect(r.stdout).not.toMatch(/POSTGRES_PASSWORD/);
    expect(r.json?.secret_redaction).toBe(true);
  });
});

// ------------------------------------------------------------------
// Carry-over safety invariants (Tests 12-17 from Task 9)
// ------------------------------------------------------------------

describe("Sprint 13 — Sprint 12 safety invariants preserved", () => {
  it("Test 12: scripts still contain set -euo pipefail", () => {
    expect(readFileSync(BACKUP_SCRIPT, "utf8")).toMatch(/set -euo pipefail/);
    expect(readFileSync(RESTORE_SCRIPT, "utf8")).toMatch(/set -euo pipefail/);
  });

  it("Test 13: scripts still refuse production hostnames", () => {
    const backup = readFileSync(BACKUP_SCRIPT, "utf8");
    const restore = readFileSync(RESTORE_SCRIPT, "utf8");
    expect(backup).toMatch(/iterlaw-postgres\\\.iterlaw-data\\\.svc\\\.cluster\\\.local|iterlaw-prod/);
    expect(restore).toMatch(/iterlaw-postgres\\\.iterlaw-data\\\.svc\\\.cluster\\\.local|iterlaw-prod/);
    expect(backup).toMatch(/REFUSED/);
    expect(restore).toMatch(/REFUSED/);
  });

  it("Test 14: scripts still avoid kubectl mutating verbs", () => {
    const banned = /kubectl\s+(apply|delete|patch|edit|scale|rollout|drain)/;
    expect(readFileSync(BACKUP_SCRIPT, "utf8")).not.toMatch(banned);
    expect(readFileSync(RESTORE_SCRIPT, "utf8")).not.toMatch(banned);
  });

  it("Test 15: manifest validator still rejects DSN-like fields", () => {
    const valid = {
      backup_id: "iterlaw-test-20260513T000000Z-1",
      created_at_utc: "2026-05-13T00:00:00Z",
      project: "iterlaw",
      environment_label: "local-staging",
      database_label: "postgres://leaky:secret@host/db",
      backup_format: "custom",
      compressed: true,
      dump_file: "x.pgcustom",
      checksum_file: "x.pgcustom.sha256",
      sha256: null,
      retention_days: 14,
      tool_versions: { pg_dump: "u", bash: "5", node: "v20" },
      git_commit: "abcdef123456",
      command_mode: "dry-run",
      secret_redaction: true,
    };
    const r = validateManifest(valid);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /postgres:\/\/|secret-like/.test(e))).toBe(true);
  });

  it("Test 16: restore target validator still rejects same source/target", () => {
    const dsn = "postgres://app:pw@host:5432/db";
    const r = validateRestoreTarget({
      sourceDsn: dsn,
      targetDsn: dsn,
      restoreLabel: "drill",
    });
    expect(r.ok).toBe(false);
  });

  it("Test 17: restore target validator still rejects production labels", () => {
    const r = validateRestoreTarget({
      targetDsn: "postgres://app:pw@drill.local:5432/db",
      restoreLabel: "production",
    });
    expect(r.ok).toBe(false);
  });
});
