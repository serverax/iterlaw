// Repo-level static checks on the IterLaw backup surface. Mirrors
// scripts/infra/verify-iterlaw-backup.sh but runs inside vitest so
// CI fails loudly on a regression even before the bash script is
// invoked.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

const PATHS = {
  runbook: join(REPO_ROOT, "docs", "infra", "BACKUP_AND_RESTORE_RUNBOOK.md"),
  backupCronjob: join(REPO_ROOT, "k8s", "iterlaw-data", "backups", "cronjob.yaml"),
  uploadCronjob: join(REPO_ROOT, "k8s", "iterlaw-data", "backups", "upload-cronjob.yaml"),
  uploadNetpol: join(REPO_ROOT, "k8s", "iterlaw-data", "backups", "upload-networkpolicy.yaml"),
  verifyCronjob: join(REPO_ROOT, "k8s", "iterlaw-data", "backups", "verify-cronjob.yaml"),
  borgSecret: join(REPO_ROOT, "k8s", "iterlaw-data", "secrets", "iterlaw-backup-borg.example.yaml"),
  restoreScript: join(REPO_ROOT, "apps", "legal-orchestrator", "scripts", "restore-from-borg.sh"),
};

function read(path: string): string {
  return readFileSync(path, "utf8");
}

// Strip line comments before scanning bodies — so the verify cronjob's
// "this job does NOT call pg_restore --dbname" header sentence is not
// flagged as a violation.
function stripYamlComments(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

describe("backup runbook + manifests are present", () => {
  for (const [name, path] of Object.entries(PATHS)) {
    it(`${name} file exists`, () => {
      expect(existsSync(path), `expected ${path}`).toBe(true);
      expect(statSync(path).isFile()).toBe(true);
    });
  }
});

describe("backup cronjob uses pg_dump --format=custom and includes both schemas", () => {
  const body = read(PATHS.backupCronjob);

  it("uses --format=custom (not --format=plain)", () => {
    expect(body).toMatch(/--format=custom/);
    // The legacy "--format=plain" line MUST be gone.
    expect(body).not.toMatch(/--format=plain/);
  });

  it("includes --schema=public", () => {
    expect(body).toMatch(/--schema=public/);
  });

  it("references --schema=uk_emp_rag (conditional or unconditional)", () => {
    expect(body).toMatch(/--schema=uk_emp_rag/);
  });

  it("writes the output to /backups/iterlaw-*.dump (not .sql.gz)", () => {
    expect(body).toMatch(/\/backups\/iterlaw-[^"]*\.dump/);
  });

  it("references credentials via valueFrom: secretKeyRef (no literal password)", () => {
    expect(body).toMatch(/valueFrom:/);
    expect(body).toMatch(/secretKeyRef:/);
    expect(body).not.toMatch(/POSTGRES_PASSWORD:\s*["']?[A-Za-z0-9!@#%^&*()_+]{8,}/);
  });
});

describe("Borg example secret only carries REPLACE_ME placeholders", () => {
  const body = read(PATHS.borgSecret);
  const placeholders = [
    "REPLACE_ME_BORG_REPO",
    "REPLACE_ME_BORG_PASSPHRASE",
    "REPLACE_ME_STORAGEBOX_HOST",
    "REPLACE_ME_STORAGEBOX_USER",
    "REPLACE_ME_SSH_PRIVATE_KEY",
  ];

  for (const p of placeholders) {
    it(`contains placeholder ${p}`, () => {
      expect(body).toMatch(new RegExp(p));
    });
  }

  it("is annotated example-only", () => {
    expect(body).toMatch(/iterlaw\.io\/example-only:\s*["']?true["']?/);
  });

  it("does NOT carry a real-looking BORG_PASSPHRASE", () => {
    // Real Borg passphrases are at least 16 chars of mixed alnum / punctuation.
    // The placeholder is the literal string "REPLACE_ME_BORG_PASSPHRASE".
    expect(body).not.toMatch(/BORG_PASSPHRASE:\s*[A-Za-z0-9]{16,}\s*$/m);
  });
});

describe("upload cronjob", () => {
  const body = read(PATHS.uploadCronjob);

  it("calls borg create", () => {
    expect(body).toMatch(/borg create/);
  });

  it("references the iterlaw-backup-borg secret via envFrom", () => {
    expect(body).toMatch(/iterlaw-backup-borg/);
    expect(body).toMatch(/secretRef:/);
  });

  it("mounts the backup PVC read-only", () => {
    expect(body).toMatch(/readOnly:\s*true/);
  });

  it("fails closed when required env vars are missing", () => {
    expect(body).toMatch(/BORG_REPO:\?/);
    expect(body).toMatch(/BORG_PASSPHRASE:\?/);
    expect(body).toMatch(/SSH_PRIVATE_KEY:\?/);
  });

  it("references alerting placeholders (no real values)", () => {
    expect(body).toMatch(/BACKUP_ALERT_WEBHOOK_URL/);
  });

  it("carries the draft-not-applied annotation", () => {
    expect(body).toMatch(/draft-not-applied/);
  });
});

describe("upload network policy", () => {
  const body = read(PATHS.uploadNetpol);

  it("default-denies inbound", () => {
    expect(body).toMatch(/ingress:\s*\[\]/);
  });

  it("permits DNS egress", () => {
    expect(body).toMatch(/k8s-app:\s*kube-dns/);
  });

  it("carries the policy-todo annotation about narrowing the CIDR", () => {
    expect(body).toMatch(/policy-todo/);
  });
});

describe("verify cronjob is a drill, NOT a real restore", () => {
  const body = read(PATHS.verifyCronjob);
  const code = stripYamlComments(body);

  it("calls borg check or pg_restore --list", () => {
    expect(code).toMatch(/borg check|pg_restore --list/);
  });

  it("does NOT call pg_restore --dbname (no production restore from a verify job)", () => {
    expect(code).not.toMatch(/pg_restore --dbname/);
  });

  it("runs on a weekly Monday schedule", () => {
    expect(body).toMatch(/schedule:\s*["']?0 6 \* \* 1["']?/);
  });

  it("references the iterlaw-backup-borg secret", () => {
    expect(body).toMatch(/iterlaw-backup-borg/);
  });
});

describe("restore script — production guards", () => {
  const body = read(PATHS.restoreScript);

  it("uses set -euo pipefail", () => {
    expect(body).toMatch(/set -euo pipefail/);
  });

  it("has a FORCE_RESTORE override guard", () => {
    expect(body).toMatch(/FORCE_RESTORE/);
  });

  it("refuses to restore against the production iterlaw-postgres host without override", () => {
    expect(body).toMatch(/iterlaw-postgres\.iterlaw-data\.svc\.cluster\.local/);
    expect(body).toMatch(/REFUSED/);
  });

  it("does NOT carry literal credentials", () => {
    expect(body).not.toMatch(/POSTGRES_PASSWORD=[A-Za-z0-9!@#$%^&*()]{8,}/);
    expect(body).not.toMatch(/BORG_PASSPHRASE=[A-Za-z0-9!@#$%^&*()]{8,}/);
  });
});

describe("sweep — no literal-looking secret in any backup file", () => {
  const banned = [
    /github_pat_/,
    /ghp_[A-Za-z0-9]{20,}/,
    /sk-proj-[A-Za-z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
  ];
  for (const [name, path] of Object.entries(PATHS)) {
    if (!path.endsWith(".yaml") && !path.endsWith(".sh") && !path.endsWith(".md")) continue;
    it(`${name} is clean of common secret patterns`, () => {
      const body = read(path);
      for (const re of banned) {
        expect(body, `unexpected match for ${re} in ${path}`).not.toMatch(re);
      }
    });
  }
});
